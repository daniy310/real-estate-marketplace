//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
}

contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this method !");
        _;
    }

    modifier onlyBuyer(uint256 _nftID) {
        require(
            msg.sender == buyer[_nftID],
            "Only buyer can call this method !"
        );
        _;
    }

    modifier onlyInspector() {
        require(
            msg.sender == inspector,
            "Only inspector can call this method !"
        );
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    function list(
        uint256 _nftID,
        address _buyer,
        uint _purchasePrice,
        uint256 _escrowAmount
    ) public payable onlySeller {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);
        isListed[_nftID] = true;
        buyer[_nftID] = _buyer;
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
    }

    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(msg.value >= escrowAmount[_nftID]);
    }

    function updateInspectionStatus(
        uint256 _nftID,
        bool _passed
    ) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    function approveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    function finalizeSale(uint256 _nftID) public {
        require(
            inspectionPassed[_nftID],
            "The property did not pass the inspection !"
        );
        require(
            approval[_nftID][buyer[_nftID]],
            "The transaction has not been approved by the buyer !"
        );
        require(
            approval[_nftID][seller],
            "The transaction has not been approved by the seller !"
        );
        require(
            approval[_nftID][lender],
            "The transaction has not been approved by the lender !"
        );
        require(
            address(this).balance >= purchasePrice[_nftID],
            "Not enough funds !"
        );

        isListed[_nftID] = false;

        (bool s, ) = payable(seller).call{value: address(this).balance}("");
        require(s, "Transaction failed !");

        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    //Cancel Sale (handle earnest deposit)
    function cancelSale(uint256 _nftID) public {
        if (inspectionPassed[_nftID] == true) {
            payable(seller).call{value: address(this).balance}("");
        } else {
            payable(buyer[_nftID]).call{value: address(this).balance}(""); 
        }
    }

    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
