const { expect, assert } = require("chai");
const { network, ethers, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NFT Marketplace Test", function () {
          let nftMarketPlaceContract, nftMarketPlace, deployer, basicNft, basicNftContract, player;
          const PRICE = ethers.utils.parseEther("0.1");
          const TOKEN_ID = 0;
          beforeEach(async function () {
              const accounts = await ethers.getSigners();
              deployer = accounts[0];
              player = accounts[1];
              await deployments.fixture(["all"]);
              nftMarketPlaceContract = await ethers.getContract("NftMarketplace");
              nftMarketPlace = nftMarketPlaceContract.connect(deployer);
              basicNftContract = await ethers.getContract("BasicNft");
              basicNft = basicNftContract.connect(deployer);
              await basicNft.mintNft();
              await basicNft.approve(nftMarketPlaceContract.address, TOKEN_ID);
          });
          describe("Listing Item", function () {
              it("emits an event after listing nft", async function () {
                  expect(
                      await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE)
                  ).to.emit("ItemListed");
              });
              it("sholud not relist the same nft", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})`;
                  await expect(
                      nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error);
              });
              it("exclusively allows owner of the nft to list", async function () {
                  nftMarketPlace = nftMarketPlaceContract.connect(player);
                  await basicNft.approve(player.address, TOKEN_ID);
                  await expect(
                      nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner");
              });
              it("needs approvals to list item", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID);
                  await expect(
                      nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketPlace()");
              });
              it("Updates listing with seller and price", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID);
                  assert(listing.price.toString() == PRICE.toString());
                  assert(listing.seller.toString() == deployer.address);
              });
          });
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`;
                  await expect(
                      nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error);
              });
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  nftMarketPlace = nftMarketPlaceContract.connect(player);
                  await basicNft.approve(player.address, TOKEN_ID);
                  await expect(
                      nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotOwner");
              });
              it("emits event and removes listing", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  expect(await nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  );
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID);
                  assert(listing.price.toString() == "0");
              });
          });
          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(
                      nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed");
              });
              it("reverts if the price isnt met", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  await expect(
                      nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet");
              });
              it("transfers the nft to the buyer and updates internal proceeds record", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  nftMarketPlace = nftMarketPlaceContract.connect(player);
                  expect(
                      await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought");
                  const newOwner = await basicNft.ownerOf(TOKEN_ID);
                  const deployerProceeds = await nftMarketPlace.getProceeds(deployer.address);
                  assert(newOwner.toString() == player.address);
                  assert(deployerProceeds.toString() == PRICE.toString());
              });
          });
          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotListed");
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  nftMarketPlace = nftMarketPlaceContract.connect(player);
                  await expect(
                      nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner");
              });
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2");
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  expect(
                      await nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed");
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID);
                  assert(listing.price.toString() == updatedPrice.toString());
              });
          });
          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(nftMarketPlace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NotProceeds"
                  );
              });
              it("withdraws proceeds", async function () {
                  await nftMarketPlace.listItems(basicNft.address, TOKEN_ID, PRICE);
                  nftMarketPlace = nftMarketPlaceContract.connect(player);
                  await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE });
                  nftMarketPlace = nftMarketPlaceContract.connect(deployer);

                  const deployerProceedsBefore = await nftMarketPlace.getProceeds(
                      deployer.address
                  );
                  const deployerBalanceBefore = await deployer.getBalance();
                  const txResponse = await nftMarketPlace.withdrawProceeds();
                  const transactionReceipt = await txResponse.wait(1);
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const deployerBalanceAfter = await deployer.getBalance();

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  );
              });
          });
      });
