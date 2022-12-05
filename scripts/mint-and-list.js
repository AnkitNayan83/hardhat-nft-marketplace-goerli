const { ethers } = require("hardhat");

async function mintAndList() {
    const randomNum = 1;
    let basicNft;
    if (randomNum == 1) {
        basicNft = await ethers.getContract("BasicNft");
    } else {
        basicNft = await ethers.getContract("BasicNft2");
    }
    const nftMarketplace = await ethers.getContract("NftMarketplace");
    console.log("Minting......");
    const mintTx = await basicNft.mintNft();
    const mintTxReceit = await mintTx.wait(1);
    const tokenId = mintTxReceit.events[0].args.tokenId;
    console.log("Approving Nft...");
    const approvalTx = await basicNft.approve(nftMarketplace.address, tokenId);
    await approvalTx.wait(1);
    console.log("Listing Nft 🔃");
    const PRICE = ethers.utils.parseEther("0.1");
    const listingTx = await nftMarketplace.listItems(basicNft.address, tokenId, PRICE);
    listingTx.wait(1);
    console.log("NFT listed ✅✅");
}

mintAndList()
    .then(() => process.exit(0))
    .catch((err) => {
        console.log(err);
        process.exit(1);
    });
