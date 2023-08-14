import { ethers } from "hardhat"
import { abis } from "./abi"
const provider = ethers.provider

// deploy the pwn protocol + simple loan with compound passive yield on the hardhat default network
// the deployed simpleLoan address is always:  0x9B137463d4E7986D7f535f9B79e28b4EF1938E9b
// the deployed simpleOffer address is always: 0x2387b3383E89c164781d173B7Aa14d9c46eD2642

// also send USDC to hardhat account 1

const main = async () => {

    const [owner, collector] = await ethers.getSigners()
    const deadAddress = await ethers.getImpersonatedSigner("0x000000000000000000000000000000000000dEaD")

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

    const simpleLoan = await simpleLoanFactory.connect(deadAddress).deploy(hub.address,loan.address,config.address)
    const simpleOffer = await simpleOfferFactory.connect(deadAddress).deploy(hub.address,revokedOfferNonce.address)
    const simpleRequest = await simpleRequestFactory.deploy(hub.address,revokedRequestNonce.address)

    await hub.setTags([simpleLoan.address, simpleOffer.address, simpleOffer.address, simpleRequest.address, simpleRequest.address],
        [ACTIVE_LOAN, SIMPLE_LOAN_TERMS_FACTORY, LOAN_OFFER, SIMPLE_LOAN_TERMS_FACTORY, LOAN_REQUEST], true)

    // usdc
    const USDCHolder = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"
    const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    const usdcHolder = await ethers.getImpersonatedSigner(USDCHolder)
    const usdc = new ethers.Contract(USDCAddress,abis.erc20Abi,provider)
    await usdc.connect(usdcHolder).transfer(owner.address, ethers.utils.parseUnits("100000000",6))

    const compoundUsdc = new ethers.Contract("0xc3d688B66703497DAA19211EEdff47f25384cdc3",abis.compoundAbi,provider)
    await usdc.connect(owner).approve(compoundUsdc.address, ethers.utils.parseUnits("200000",6))
    await compoundUsdc.connect(owner).supply(USDCAddress, ethers.utils.parseUnits("200000",6)) 
}

main()