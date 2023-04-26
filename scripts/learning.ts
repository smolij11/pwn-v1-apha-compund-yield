import { ethers } from "hardhat"
import { BigNumber } from "ethers"
import { simple } from "../typechain-types/contracts/loan/terms"
import { abis } from "./abi"
import { time } from "@nomicfoundation/hardhat-network-helpers";

const provider = ethers.provider

const binance7 = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8"
const dummyErc20Address =   "0xf2F3bD7Ca5746C5fac518f67D1BE87805a2Be82A"
const dummyErc721Address =  "0x71B821aa52a49F32EEd535fCA6Eb5aa130085978"
const compoundUSDCAddress = "0xc3d688B66703497DAA19211EEdff47f25384cdc3"
const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const WETHAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const USDCHolder = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"

const forkTest = async () => {
    const balance = await provider.getBalance(binance7)
    console.log("Binance 7: " + ethers.utils.formatEther(balance) + "ETH")
}

/*
    There will only be 1 PWNhub deployed
    Owner of PWNHub can set various bytes32 tags to true/false for addresses
*/
const PWNHubOnly = async () => {
    const [owner,other] = await ethers.getSigners();
    const tagBytes = "0x0000000000000000000000000000000000000000000000000000000000000001"

    const hubFactory = await ethers.getContractFactory("PWNHub")
    const hub = await hubFactory.deploy()

    let hasTag = await hub.hasTag(binance7,tagBytes)
    console.log(hasTag)

    await hub.setTag(binance7,tagBytes,true)
    hasTag = await hub.hasTag(binance7,tagBytes)
    console.log(hasTag)

    await hub.setTag(binance7,tagBytes,false)
    hasTag = await hub.hasTag(binance7,tagBytes)
    console.log(hasTag)
}

/* 
    Bytes32 tags for the protocol
*/
const PWNHubTagsTest = async () => {
    const [owner,other] = await ethers.getSigners();

    const hubFactory = await ethers.getContractFactory("PWNHub")
    const hub = await hubFactory.deploy()

    const tagsFactory = await ethers.getContractFactory("PWNHubTags")
    const tags = await tagsFactory.deploy()

    const activeLoanTag = await tags.ACTIVE_LOAN()
    const loanOfferTag = await tags.LOAN_OFFER()

    let hasTag = await hub.hasTag(binance7,activeLoanTag)
    console.log("active loan: " + hasTag)
    hasTag = await hub.hasTag(binance7,loanOfferTag)
    console.log("loan offer: " + hasTag)

    console.log("set active loan tag to true")
    await hub.setTag(binance7,activeLoanTag,true)

    hasTag = await hub.hasTag(binance7,activeLoanTag)
    console.log("active loan: " + hasTag)
    hasTag = await hub.hasTag(binance7,loanOfferTag)
    console.log("loan offer: " + hasTag)
}

/*
    Deployed behind a proxy.
    The owner of PWNConfig can set the fee and the fee collector address.
*/
const PWNConfigOnly = async () => {
    const [owner,collector] = await ethers.getSigners();

    const configFactory = await ethers.getContractFactory("PWNConfig")
    const config = await configFactory.deploy()

    await config.initialize(owner.address)

    await config.reinitialize(owner.address, 20, collector.address)

    console.log("fee: " + await config.fee())
    console.log("collector: " + await config.feeCollector())

    await config.setFee(30)
    await config.setFeeCollector(binance7)

    console.log("fee: " + await config.fee())
    console.log("collector: " + await config.feeCollector())
}

/*
    LOAN ERC721 that can be minted and burned
    It can be minted only by Active Loan Tagged contrats in the hub
    It can be burned only by the contract that minted it.
*/
const PWNLOANTest = async () => {
    const [owner,activeloan1,activeloan2,lender] = await ethers.getSigners();

    const hubFactory = await ethers.getContractFactory("PWNHub")
    const hub = await hubFactory.deploy()

    const tagsFactory = await ethers.getContractFactory("PWNHubTags")
    const tags = await tagsFactory.deploy()

    const activeLoanTag = await tags.ACTIVE_LOAN()

    const loanFactory = await ethers.getContractFactory("PWNLOAN")
    const loan = await loanFactory.deploy(hub.address)

    await hub.setTag(activeloan1.address, activeLoanTag, true)
    await loan.connect(activeloan1).mint(lender.address)

    console.log("owner:" + await loan.ownerOf(1))

    console.log("loan contract:" + await loan.loanContract(1))

    await loan.connect(activeloan1).burn(1)
}

const deployAllAndTest = async () => {
    const [owner, collector, lender, borrower] = await ethers.getSigners()

    const hubFactory = await ethers.getContractFactory("PWNHub")
    const tagsFactory = await ethers.getContractFactory("PWNHubTags")
    const configFactory = await ethers.getContractFactory("PWNConfig")
    const loanFactory = await ethers.getContractFactory("PWNLOAN")
    const revokedNonceFactory = await ethers.getContractFactory("PWNRevokedNonce")
    const simpleLoanFactory = await ethers.getContractFactory("PWNSimpleLoan")
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

    // Protocol is fully deployed now, time to mint dummy tokens now

    const ERC20 =  new ethers.Contract(dummyErc20Address,  abis.erc20Abi,  provider)
    const ERC721 = new ethers.Contract(dummyErc721Address, abis.erc721Abi, provider)

    await ERC721.connect(borrower).mint(420)
    await ERC20.connect(lender).mint(ethers.utils.parseEther("20000000"))

    await ERC721.connect(borrower).approve(simpleLoan.address,420)
    await ERC20.connect(lender).approve(simpleLoan.address,ethers.utils.parseEther("20000000"))

    // -------------------

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
        collateralId: 420,
        collateralAmount: 0,
        loanAssetAddress: "0xf2F3bD7Ca5746C5fac518f67D1BE87805a2Be82A",
        loanAmount: ethers.utils.parseEther("20000000"),
        loanYield: ethers.utils.parseEther("1000000"),
        duration: 1000,
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

    //console.log("lender balance before: " + await ERC20.balanceOf(lender.address))
    
    await simpleLoan.connect(borrower).createLOAN(simpleOffer.address,offerData,signature,[],[])

    //console.log("lender balance during: " + await ERC20.balanceOf(lender.address))

    await ERC20.connect(borrower).mint(ethers.utils.parseEther("1000000"))
    
    await ERC20.connect(borrower).approve(simpleLoan.address,ethers.utils.parseEther("23000000"))
    await simpleLoan.connect(borrower).repayLOAN(1,[])

    await simpleLoan.connect(lender).claimLOAN(1)

    //console.log("lender balance after: " + await ERC20.balanceOf(lender.address))

}

const playWithCompoundComet = async () => {
    const [lp, borrower] = await ethers.getSigners()
    const usdcHolder = await ethers.getImpersonatedSigner(USDCHolder)

    const compound = new ethers.Contract(compoundUSDCAddress,abis.compoundAbi,provider)

    const usdc = new ethers.Contract(USDCAddress,abis.erc20Abi,provider)
    const weth = new ethers.Contract(WETHAddress,abis.wethAbi,provider)

    await weth.connect(borrower).deposit({value: ethers.utils.parseEther("1000")})

    await usdc.connect(usdcHolder).transfer(lp.address,BigNumber.from("200000000000000"))
    await usdc.connect(usdcHolder).transfer(borrower.address,BigNumber.from("100000000000000"))

    await usdc.connect(lp).approve(compound.address,BigNumber.from("200000000000000"))
    //await usdc.connect(borrower).approve(compound.address,BigNumber.from("100000000000000"))

    await compound.connect(lp).supply(USDCAddress,BigNumber.from("200000000000000"))
    //await compound.connect(borrower).supply(USDCAddress,BigNumber.from("100000000000000"))

    await weth.connect(borrower).approve(compound.address,ethers.utils.parseEther("1000"))
    await compound.connect(borrower).supply(WETHAddress,ethers.utils.parseEther("1000"))

    console.log(await compound.balanceOf(lp.address))
    console.log(await compound.balanceOf(borrower.address))

    await time.increase(3600*72);

    //await compound.connect(borrower).withdraw(USDCAddress,BigNumber.from("1938000000000").mul(82).div(100))

    await usdc.connect(borrower).approve(compound.address,BigNumber.from("100000000000000"))

    //await compound.connect(borrower).supply(USDCAddress,BigNumber.from("1938000000000"))

    console.log(await compound.balanceOf(lp.address))
    console.log(await compound.balanceOf(borrower.address))

    await compound.connect(lp).withdraw(USDCAddress,BigNumber.from("200025000000000"))

    console.log(await compound.balanceOf(lp.address))
    console.log(await compound.balanceOf(borrower.address))
}

const compoundAllow = async () => {
    const [lp, manager, pwnBorrower] = await ethers.getSigners()
    const usdcHolder = await ethers.getImpersonatedSigner(USDCHolder)

    const usdc = new ethers.Contract(USDCAddress,abis.erc20Abi,provider)
    const compound = new ethers.Contract(compoundUSDCAddress,abis.compoundAbi,provider)

    await usdc.connect(usdcHolder).transfer(lp.address,BigNumber.from("100000000000000"))

    await usdc.connect(lp).approve(compound.address,BigNumber.from("100000000000000"))

    await compound.connect(lp).supply(USDCAddress,BigNumber.from("100000000000000"))

    await compound.connect(lp).allow(manager.address,true)

    console.log("compound lp balance:\t\t" + await compound.balanceOf(lp.address))

    await compound.connect(manager).withdrawFrom(lp.address, pwnBorrower.address, USDCAddress, BigNumber.from("50000000000000"))

    console.log("compound lp balance:\t\t" + await compound.balanceOf(lp.address))
    console.log("usdc pwnBorrower balance:\t" + await usdc.balanceOf(pwnBorrower.address))
}

compoundAllow()