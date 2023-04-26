import { ethers } from "hardhat"
import { BigNumber, ethers } from "ethers"
import { simple } from "../typechain-types/contracts/loan/terms"
import { abis } from "./abi"
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { formatUnits } from "ethers/lib/utils";

const provider = ethers.provider

const binance7 = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"
const dummyErc20Address =   "0xf2F3bD7Ca5746C5fac518f67D1BE87805a2Be82A"
const dummyErc721Address =  "0x71B821aa52a49F32EEd535fCA6Eb5aa130085978"
const compoundUSDCAddress = "0xc3d688B66703497DAA19211EEdff47f25384cdc3"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const USDCHolder = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"


const main = async () => {

    const [owner, collector, lender, borrower] = await ethers.getSigners()

    const usdc = new ethers.Contract(USDCAddress,abis.erc20Abi,provider)

    const compoundUsdc = new ethers.Contract(compoundUSDCAddress,abis.compoundAbi,provider)

    const ERC721 = new ethers.Contract(dummyErc721Address, abis.erc721Abi, provider)

    // Deploying the PWN v1 protocol - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

    const hubFactory = await ethers.getContractFactory("PWNHub")
    const tagsFactory = await ethers.getContractFactory("PWNHubTags")
    const configFactory = await ethers.getContractFactory("PWNConfig")
    const loanFactory = await ethers.getContractFactory("PWNLOAN")
    const revokedNonceFactory = await ethers.getContractFactory("PWNRevokedNonce")
    const simpleLoanFactory = await ethers.getContractFactory("PWNSimplePassiveYieldLoan1")
    const simpleOfferFactory = await ethers.getContractFactory("PWNSimpleLoanSimpleOffer")
    const simpleRequestFactory = await ethers.getContractFactory("PWNSimpleLoanSimpleRequest")

    const hub = await hubFactory.deploy()
    const tags = await tagsFactory.deploy()

    const ACTIVE_LOAN = await tags.ACTIVE_LOAN()
    const LOAN_OFFER = await tags.LOAN_OFFER()
    const LOAN_REQUEST = await tags.LOAN_REQUEST()
    const SIMPLE_LOAN_TERMS_FACTORY = await tags.SIMPLE_LOAN_TERMS_FACTORY()

    const config = await configFactory.deploy()
    await config.initialize(owner.address)
    await config.reinitialize(owner.address, 0, collector.address)

    const loan = await loanFactory.deploy(hub.address)
    const revokedOfferNonce = await revokedNonceFactory.deploy(hub.address,LOAN_OFFER)
    const revokedRequestNonce = await revokedNonceFactory.deploy(hub.address,LOAN_REQUEST)

    const simpleLoan = await simpleLoanFactory.deploy(hub.address,loan.address,config.address)
    const simpleOffer = await simpleOfferFactory.deploy(hub.address,revokedOfferNonce.address)
    const simpleRequest = await simpleRequestFactory.deploy(hub.address,revokedRequestNonce.address)

    await hub.setTags([simpleLoan.address, simpleOffer.address, simpleOffer.address, simpleRequest.address, simpleRequest.address],
        [ACTIVE_LOAN, SIMPLE_LOAN_TERMS_FACTORY, LOAN_OFFER, SIMPLE_LOAN_TERMS_FACTORY, LOAN_REQUEST], true)

    // The protocol is now fully deployed - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    
    // Lender gets USDC and than deposits/supplies to the Compound lending protocol

    const usdcHolder = await ethers.getImpersonatedSigner(USDCHolder)
    await usdc.connect(usdcHolder).transfer(lender.address, ethers.utils.parseUnits("1000000",6))     // lender has 1 mil USDC now

    console.log("USDC Lender Balance:\t" + ethers.utils.formatUnits(await usdc.balanceOf(lender.address),6) + "\n- - - - -")
    
    await usdc.connect(lender).approve(compoundUsdc.address, ethers.utils.parseUnits("1000000",6))
    await compoundUsdc.connect(lender).supply(USDCAddress, ethers.utils.parseUnits("1000000",6))      // lender supplies 1 mil USDC

    console.log("USDC Lender Balance:\t" + ethers.utils.formatUnits(await usdc.balanceOf(lender.address),6))
    console.log("Compund Lender Balance:\t" + ethers.utils.formatUnits(await compoundUsdc.balanceOf(lender.address),6) + "\n- - - - -")

    // Lender allows PWN Loan contract to withdraw from his Compound balance

    await compoundUsdc.connect(lender).allow(simpleLoan.address, true)

    // Borrower gets a dummy NFT and approves it for the PWN Loan address
    
    await ERC721.connect(borrower).mint(222)
    await ERC721.connect(borrower).approve(simpleLoan.address,222)

    // Lender signs an offer to lend 500k USDC for dummy NFT collateral - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    const domain = {
        name: "PWNSimpleLoanSimpleOffer",
        version: "1",
        chainId: 31337, // Default hardhat network chain id
        verifyingContract: simpleOffer.address
    }

    const offerTypes = {
        Offer: [
            { name: "collateralCategory", type: "uint8" },
            { name: "collateralAddress", type: "address" },
            { name: "collateralId", type: "uint256" },
            { name: "collateralAmount", type: "uint256" },
            { name: "loanAssetAddress", type: "address" },
            { name: "loanAmount", type: "uint256" },
            { name: "loanYield", type: "uint256" },
            { name: "duration", type: "uint32" },
            { name: "expiration", type: "uint40" },
            { name: "borrower", type: "address" },
            { name: "lender", type: "address" },
            { name: "isPersistent", type: "bool" },
            { name: "nonce", type: "uint256" }
        ]
    }

    const offer = {
        collateralCategory: 1,
        collateralAddress: "0x71B821aa52a49F32EEd535fCA6Eb5aa130085978",
        collateralId: 222,
        collateralAmount: 0,
        loanAssetAddress: USDCAddress,
        loanAmount: ethers.utils.parseUnits("500000",6),
        loanYield: ethers.utils.parseUnits("50000",6),
        duration: 1000000000,
        expiration: 1680788965*2,
        borrower: borrower.address,
        lender: lender.address,
        isPersistent: false,
        nonce: "0x0000000000000000000000000000000000000000000000000000000000000001"
    }

    const offerData = ethers.utils.AbiCoder.prototype.encode(
        ["uint8","address","uint256","uint256","address","uint256","uint256","uint32","uint40","address","address","bool","uint256"],
        [offer.collateralCategory,offer.collateralAddress,offer.collateralId,offer.collateralAmount,offer.loanAssetAddress,offer.loanAmount,
        offer.loanYield,offer.duration,offer.expiration,offer.borrower,offer.lender,offer.isPersistent,offer.nonce]
    );

    const signature = await lender._signTypedData(domain,offerTypes,offer)

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    // Borrower creates the loan
    await time.increase(3600*72);

    await simpleLoan.connect(borrower).createLOAN(simpleOffer.address,offerData,signature,[],[])

    console.log("USDC Borrower Balance:\t" + ethers.utils.formatUnits(await usdc.balanceOf(borrower.address),6))
    console.log("Compund Lender Balance:\t" + ethers.utils.formatUnits(await compoundUsdc.balanceOf(lender.address),6) + "\n- - - - -")

    // Borrower gets 50k USDC and repays the loan
    await time.increase(3600*72);

    await usdc.connect(usdcHolder).transfer(borrower.address, ethers.utils.parseUnits("50000",6))

    await usdc.connect(borrower).approve(simpleLoan.address, ethers.utils.parseUnits("550000",6))
    await simpleLoan.connect(borrower).repayLOAN(1,[])

    // Lender claims the loan

    await simpleLoan.connect(lender).claimLOAN(1)

    console.log("USDC Lender Balance:\t" + ethers.utils.formatUnits(await usdc.balanceOf(lender.address),6))
    console.log("Compund Lender Balance:\t" + ethers.utils.formatUnits(await compoundUsdc.balanceOf(lender.address),6) + "\n- - - - -")

    // this can be inserted anywhere to increase yield
    await time.increase(3600*72);
}


main()