// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketPlace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId);
error NftMarketplace__NotProceeds();

/**
 * @title A NFT MarketPlace
 * @author Ankit Nayan
 * @notice you can use this contract to buy sell or list your nft
 */
contract NftMarketplace is ReentrancyGuard {
    //Types
    struct Listing {
        uint256 price;
        address seller;
    }

    //Events
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    //Varibles
    mapping(address => mapping(uint256 => Listing)) private s_listing;
    mapping(address => uint256) private s_proceeds;

    /************************** */
    /********MODIFIERS******/
    /************************** */
    modifier notListed(address nftAddress, uint256 tokenId) {
        Listing memory list = s_listing[nftAddress][tokenId];
        if (list.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory list = s_listing[nftAddress][tokenId];
        if (list.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address seller
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (owner != seller) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    /************************** */
    /********Main Function******/
    /************************** */

    /**
     * @notice Process to list your NFT on the marketPlace
     * @param nftAddress:Address of the nft(nft should be owned by you!!!)
     * @param tokenId: Id associated with your nft
     * @param price: Price at which you wanna list your nft
     */
    function listItems(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external notListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketPlace();
        }
        s_listing[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    /**
     * @notice this function allow user to buy an nft from the marketPlace
     * @param nftAddress: Address of the nft which you wnat to buy
     * @param tokenId: Id of your nft
     */
    function buyItem(
        address nftAddress,
        uint256 tokenId
    ) external payable nonReentrant isListed(nftAddress, tokenId) {
        Listing memory listItem = s_listing[nftAddress][tokenId];
        if (msg.value < listItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId);
        }
        s_proceeds[listItem.seller] += msg.value;
        delete (s_listing[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listItem.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listItem.price);
    }

    /**
     * @notice Method to cancel your listed nft
     * @param nftAddress: address of your nft
     * @param tokenId: ID of your nft
     */
    function cancelItem(
        address nftAddress,
        uint256 tokenId
    ) external isOwner(nftAddress, tokenId, msg.sender) isListed(nftAddress, tokenId) {
        delete (s_listing[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    /**
     * @notice Method for updating listing
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param newPrice Price in Wei of the item
     */
    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
        nonReentrant
    {
        if (newPrice <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        s_listing[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    /**
     * @notice Method for withdrawing your ETH
     */
    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NotProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer failed");
    }

    /************************** */
    /********Getter Function******/
    /************************** */

    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listing[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
