import { abis } from "./abi.js"

const provider = new _ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/")

const connectMetamaskButton = document.getElementById("connectMetamask")
const walletAddress = document.getElementById("walletAddress")
const walletBalance = document.getElementById("walletBalance")
const walletUsdcBalance = document.getElementById("walletUsdcBalance")
const compoundBalance = document.getElementById("compoundBalance")

window.address = null
window.nftId = 0
window.signature = null
window.offerData = null
window.loanId = 0

const loanAddress = "0x9B137463d4E7986D7f535f9B79e28b4EF1938E9b"
const offerAddress = "0x2387b3383E89c164781d173B7Aa14d9c46eD2642"
const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const dummyErc721Address =  "0x71B821aa52a49F32EEd535fCA6Eb5aa130085978"

const hardhatSigner = new _ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider)
const usdc = new _ethers.Contract(usdcAddress,abis.erc20Abi,provider)
const compoundUsdc = new ethers.Contract("0xc3d688B66703497DAA19211EEdff47f25384cdc3",abis.compoundAbi,provider)
const ERC721 = new _ethers.Contract(dummyErc721Address, abis.erc721Abi, provider)
const loanContract = new _ethers.Contract(loanAddress, abis.loanAbi, provider)

if (typeof window.ethereum !== 'undefined') {
    console.log('MetaMask is installed!');
}

connectMetamaskButton.addEventListener("click", async () => {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
.catch((err) => {
  if (err.code === 4001) {
    // EIP-1193 userRejectedRequest error
    // If this happens, the user rejected the connection request.
    console.log('Please connect to MetaMask.');
  } else {
    console.error(err);
  }
})
window.address = accounts[0]

walletAddress.innerText = "connected address:  " + window.address

await updateAllBalances()
})

const updateAllBalances = async () => {
    updateBalance(await getBalance(window.address))
    updateUsdcBalance(await getUsdcBalance(window.address))
    updateCompoundBalance(await getCompoundBalance(window.address))
}

// ethereum

const getBalance = async (address) => {
    const balance = await provider.getBalance(address)
    return _ethers.utils.formatEther(balance)
}

const updateBalance = (balance) => {
    walletBalance.innerText = "ETH Balance: " + Number(balance).toFixed(5)
}

// USDC

const getUsdcBalance = async (address) => {
    const balance = await usdc.balanceOf(address)
    return _ethers.utils.formatUnits(balance,6)
}

const updateUsdcBalance = (balance) => {
    walletUsdcBalance.innerText = "USDC Balance: " + Number(balance).toFixed(2)
}

// compoundUsdc

const getCompoundBalance = async (address) => {
    const balance = await compoundUsdc.balanceOf(address)
    return _ethers.utils.formatUnits(balance,6)
}

const updateCompoundBalance = (balance) => {
    compoundBalance.innerText = "COMP USDC Balance: " + Number(balance).toFixed(2)
}

// Get Buttons

const getEth = async () => {
    await hardhatSigner.sendTransaction({
        to: window.address,
        value: _ethers.utils.parseEther("1.0")
    })

    updateBalance(await getBalance(window.address))
}

const getUsdc = async () => {
    await usdc.connect(hardhatSigner).transfer(window.address, ethers.utils.parseUnits("1000000",6))

    await updateAllBalances()
}

window.getEth = getEth
window.getUsdc = getUsdc

// Compound Stuff

const depositInput = document.getElementById("depositInput")
const withdrawInput = document.getElementById("withdrawInput")

const depositUsdc = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await compoundUsdc.connect(signer).supply(usdcAddress, ethers.utils.parseUnits(depositInput.value,6))
    await updateAllBalances()
}

const withdrawUsdc = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await compoundUsdc.connect(signer).withdraw(usdcAddress, ethers.utils.parseUnits(withdrawInput.value,6))
    await updateAllBalances()
}

const approveUsdc = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await usdc.connect(signer).approve(compoundUsdc.address, ethers.utils.parseUnits("1000000000",6))
}

const allowPwn = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await compoundUsdc.connect(signer).allow(loanAddress, true)
}

window.approveUsdc = approveUsdc
window.allowPwn = allowPwn
window.depositUsdc = depositUsdc
window.withdrawUsdc = withdrawUsdc

// NFT

const mintedDiv = document.getElementById("minted-nft")

const mintNFT = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await ERC721.connect(signer).mint(++window.nftId)
    await updateAllBalances()

    document.getElementById("borrower-address").value = window.address
    document.getElementById("collateral-id").value = window.nftId
    mintedDiv.innerText = "minted: id = " + window.nftId + ", address = " + dummyErc721Address
}

const approveNFTs = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await ERC721.connect(signer).setApprovalForAll(loanAddress,true)
    await updateAllBalances()
}

window.mintNFT = mintNFT
window.approveNFTs = approveNFTs

// Offer Sign

const signOffer = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    const domain = {
        name: "PWNSimpleLoanSimpleOffer",
        version: "1",
        chainId: 31337, // Default hardhat network chain id
        verifyingContract: offerAddress
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

    const dur = Number(document.getElementById("duration").value)*24*60*60

    const offer = {
        collateralCategory: 1,
        collateralAddress: document.getElementById("collateral-address").value,
        collateralId: document.getElementById("collateral-id").value,
        collateralAmount: 0,
        loanAssetAddress: document.getElementById("loan-asset-address").value,
        loanAmount: ethers.utils.parseUnits( document.getElementById("loan-amount").value, 6),
        loanYield: ethers.utils.parseUnits( document.getElementById("loan-yield").value, 6),
        duration: dur,
        expiration: 1691957686*2,
        borrower: document.getElementById("borrower-address").value,
        lender: window.address,
        isPersistent: false,
        nonce: "0x0000000000000000000000000000000000000000000000000000000000000001"
    }

    const offerData = ethers.utils.AbiCoder.prototype.encode(
        ["uint8","address","uint256","uint256","address","uint256","uint256","uint32","uint40","address","address","bool","uint256"],
        [offer.collateralCategory,offer.collateralAddress,offer.collateralId,offer.collateralAmount,offer.loanAssetAddress,offer.loanAmount,
        offer.loanYield,offer.duration,offer.expiration,offer.borrower,offer.lender,offer.isPersistent,offer.nonce]
    );

    const signature = await signer._signTypedData(domain,offerTypes,offer)
    window.signature = signature
    window.offerData = offerData
    await updateAllBalances()
}

window.signOffer = signOffer

// create & repay & claim loan

const createLoan = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await loanContract.connect(signer).createLOAN(offerAddress,offerData,signature,[],[])
    window.loanId = ++window.loanId
    await updateAllBalances()
}

const approveUsdcRepay = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await usdc.connect(signer).approve(loanAddress, ethers.utils.parseUnits("1000000000",6))
    await updateAllBalances()
}

const repayLoan = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await loanContract.connect(signer).repayLOAN(window.loanId,[])
    await updateAllBalances()
}

const claimLoan = async () => {
    const provider = new _ethers.providers.Web3Provider(window.ethereum)
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    await loanContract.connect(signer).claimLOAN(window.loanId)
    await updateAllBalances()
}

window.createLoan = createLoan
window.approveUsdcRepay = approveUsdcRepay
window.repayLoan = repayLoan
window.claimLoan = claimLoan