const { network } = require("hardhat");
const { verify } = require("../utils/verify");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    if (chainId == 31337) {
        log("--------------You are on a local development chain-----------------------");
    }
    log("----------deploying------------------------------------------------------");
    const args = [];
    const nftMarketPlace = await deploy("NftMarketplace", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });
    log("---------------deployed--------------------------------------------------");

    if (chainId != 31337 && process.env.ETHERSCAN_API_KEY) {
        log("Verifying");
        await verify(nftMarketPlace.address, args);
        log("Verified");
    }
    log("----------------------------------------------------------------------------");
};

module.exports.tags = ["all", "nftmarketplace"];
