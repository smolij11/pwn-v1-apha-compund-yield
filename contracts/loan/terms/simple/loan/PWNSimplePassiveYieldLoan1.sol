// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.16;

import "contracts/multitoken/MultiToken.sol";

import "contracts/config/PWNConfig.sol";
import "contracts/hub/PWNHub.sol";
import "contracts/hub/PWNHubTags.sol";
import "contracts/loan/lib/PWNFeeCalculator.sol";
import "contracts/loan/terms/PWNLOANTerms.sol";
import "contracts/loan/terms/simple/factory/PWNSimpleLoanTermsFactory.sol";
import "contracts/loan/token/IERC5646.sol";
import "contracts/loan/token/PWNLOAN.sol";
import "contracts/loan/PWNVault.sol";
import "contracts/PWNErrors.sol";
import "contracts/CometMainInterface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PWNSimplePassiveYieldLoan1 is
    PWNVault,
    IERC5646,
    IPWNLoanMetadataProvider
{
    string internal constant VERSION = "1.0";
    uint256 public constant MAX_EXPIRATION_EXTENSION = 2_592_000;

    PWNHub internal immutable hub;
    PWNLOAN internal immutable loanToken;
    PWNConfig internal immutable config;

    // VARIABLES FOR PASSIVE YIELD
    address constant USDCAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant compoundUSDC = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;

    struct LOAN {
        uint8 status;
        address borrower;
        uint40 expiration;
        address loanAssetAddress;
        uint256 loanRepayAmount;
        MultiToken.Asset collateral;
    }

    mapping(uint256 => LOAN) private LOANs;

    event LOANCreated(uint256 indexed loanId, PWNLOANTerms.Simple terms);

    event LOANPaidBack(uint256 indexed loanId);

    event LOANClaimed(uint256 indexed loanId, bool indexed defaulted);

    event LOANExpirationDateExtended(
        uint256 indexed loanId,
        uint40 extendedExpirationDate
    );

    constructor(address _hub, address _loanToken, address _config) {
        hub = PWNHub(_hub);
        loanToken = PWNLOAN(_loanToken);
        config = PWNConfig(_config);
    }

    function createLOAN(
        address loanTermsFactoryContract,
        bytes calldata loanTermsFactoryData,
        bytes calldata signature,
        bytes calldata loanAssetPermit,
        bytes calldata collateralPermit
    ) external returns (uint256 loanId) {
        if (
            hub.hasTag(
                loanTermsFactoryContract,
                PWNHubTags.SIMPLE_LOAN_TERMS_FACTORY
            ) == false
        ) revert CallerMissingHubTag(PWNHubTags.SIMPLE_LOAN_TERMS_FACTORY);

        PWNLOANTerms.Simple memory loanTerms = PWNSimpleLoanTermsFactory(
            loanTermsFactoryContract
        ).createLOANTerms({
                caller: msg.sender,
                factoryData: loanTermsFactoryData,
                signature: signature
            });

        // only USDC
        if (loanTerms.asset.assetAddress != USDCAddress)
            revert InvalidLoanAsset();

        if (MultiToken.isValid(loanTerms.asset) == false)
            revert InvalidLoanAsset();

        if (MultiToken.isValid(loanTerms.collateral) == false)
            revert InvalidCollateralAsset();

        loanId = loanToken.mint(loanTerms.lender);

        LOAN storage loan = LOANs[loanId];
        loan.status = 2;
        loan.borrower = loanTerms.borrower;
        loan.expiration = loanTerms.expiration;
        loan.loanAssetAddress = loanTerms.asset.assetAddress;
        loan.loanRepayAmount = loanTerms.loanRepayAmount;
        loan.collateral = loanTerms.collateral;

        emit LOANCreated(loanId, loanTerms);

        _permit(loanTerms.collateral, loanTerms.borrower, collateralPermit);
        _pull(loanTerms.collateral, loanTerms.borrower);

        _permit(loanTerms.asset, loanTerms.lender, loanAssetPermit);

        // withdraw from Compound
        CometMainInterface(compoundUSDC).withdrawFrom(
            loanTerms.lender,
            address(this),
            loan.loanAssetAddress,
            loanTerms.asset.amount
        );

        uint16 fee = config.fee();
        if (fee > 0) {
            (uint256 feeAmount, uint256 newLoanAmount) = PWNFeeCalculator
                .calculateFeeAmount(fee, loanTerms.asset.amount);

            if (feeAmount > 0) {
                loanTerms.asset.amount = feeAmount;
                _push(loanTerms.asset, config.feeCollector()); // _push

                loanTerms.asset.amount = newLoanAmount;
            }
        }

        _push(loanTerms.asset, loanTerms.borrower); // _push
    }

    function repayLOAN(
        uint256 loanId,
        bytes calldata loanAssetPermit
    ) external {
        LOAN storage loan = LOANs[loanId];
        uint8 status = loan.status;

        if (status == 0) revert NonExistingLoan();
        else if (status != 2) revert InvalidLoanStatus(status);

        if (loan.expiration <= block.timestamp)
            revert LoanDefaulted(loan.expiration);

        loan.status = 3;

        MultiToken.Asset memory repayLoanAsset = MultiToken.Asset({
            category: MultiToken.Category.ERC20,
            assetAddress: loan.loanAssetAddress,
            id: 0,
            amount: loan.loanRepayAmount
        });

        _permit(repayLoanAsset, msg.sender, loanAssetPermit);

        _pull(repayLoanAsset, msg.sender);

        IERC20(loan.loanAssetAddress).approve(
            compoundUSDC,
            loan.loanRepayAmount
        );

        CometMainInterface(compoundUSDC).supplyTo(
            loanToken.ownerOf(loanId),
            loan.loanAssetAddress,
            loan.loanRepayAmount
        );

        _push(loan.collateral, loan.borrower);

        emit LOANPaidBack(loanId);
    }

    function claimLOAN(uint256 loanId) external {
        LOAN storage loan = LOANs[loanId];

        if (loanToken.ownerOf(loanId) != msg.sender)
            revert CallerNotLOANTokenHolder();

        if (loan.status == 0) {
            revert NonExistingLoan();
        } else if (loan.status == 3) {
            MultiToken.Asset memory loanAsset = MultiToken.Asset({
                category: MultiToken.Category.ERC20,
                assetAddress: loan.loanAssetAddress,
                id: 0,
                amount: loan.loanRepayAmount
            });

            _deleteLoan(loanId);

            _push(loanAsset, msg.sender);

            emit LOANClaimed(loanId, false);
        } else if (loan.status == 2 && loan.expiration <= block.timestamp) {
            MultiToken.Asset memory collateral = loan.collateral;

            _deleteLoan(loanId);

            _push(collateral, msg.sender);

            emit LOANClaimed(loanId, true);
        } else {
            revert InvalidLoanStatus(loan.status);
        }
    }

    function _deleteLoan(uint256 loanId) private {
        loanToken.burn(loanId);
        delete LOANs[loanId];
    }

    function extendLOANExpirationDate(
        uint256 loanId,
        uint40 extendedExpirationDate
    ) external {
        if (loanToken.ownerOf(loanId) != msg.sender)
            revert CallerNotLOANTokenHolder();

        LOAN storage loan = LOANs[loanId];

        if (
            extendedExpirationDate >
            uint40(block.timestamp + MAX_EXPIRATION_EXTENSION)
        ) revert InvalidExtendedExpirationDate();
        if (extendedExpirationDate <= uint40(block.timestamp))
            revert InvalidExtendedExpirationDate();
        if (extendedExpirationDate <= loan.expiration)
            revert InvalidExtendedExpirationDate();

        loan.expiration = extendedExpirationDate;

        emit LOANExpirationDateExtended(loanId, extendedExpirationDate);
    }

    function getLOAN(uint256 loanId) external view returns (LOAN memory loan) {
        loan = LOANs[loanId];
        loan.status = _getLOANStatus(loanId);
    }

    function _getLOANStatus(uint256 loanId) private view returns (uint8) {
        LOAN storage loan = LOANs[loanId];
        return
            (loan.status == 2 && loan.expiration <= block.timestamp)
                ? 4
                : loan.status;
    }

    function loanMetadataUri() external view override returns (string memory) {
        return config.loanMetadataUri(address(this));
    }

    function getStateFingerprint(
        uint256 tokenId
    ) external view virtual override returns (bytes32) {
        LOAN storage loan = LOANs[tokenId];

        if (loan.status == 0) return bytes32(0);

        return keccak256(abi.encode(_getLOANStatus(tokenId), loan.expiration));
    }
}
