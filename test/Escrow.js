const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), "ether");
};

describe("Escrow", () => {
  let buyer, seller, inspector, lender;
  let realEstate, escrow;

  beforeEach(async () => {
    //Accounts
    [buyer, seller, inspector, lender] = await ethers.getSigners();

    //Deploy
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();

    let tx = await realEstate
      .connect(seller)
      .mint(
        "https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS"
      );
    await tx.wait();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address
    );

    //Approve property
    tx = await realEstate.connect(seller).approve(escrow.address, 1);
    await tx.wait();

    //List property
    tx = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(10), tokens(5));
    await tx.wait();
  });

  describe("Deployment", () => {
    it("Returns NFT address", async () => {
      const result = await escrow.nftAddress();
      expect(result).to.be.equal(realEstate.address);
    });

    it("Returns the seller", async () => {
      const result = await escrow.seller();
      expect(result).to.be.equal(seller.address);
    });

    it("Returns the inspector", async () => {
      const result = await escrow.inspector();
      expect(result).to.be.equal(inspector.address);
    });

    it("Returns the lender", async () => {
      const result = await escrow.lender();
      expect(result).to.be.equal(lender.address);
    });
  });

  describe("Listing", () => {
    it("Updates as listed", async () => {
      const result = await escrow.isListed(1);
      expect(result).to.be.equal(true);
    });

    it("Updates the ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
    });

    it("Returns the buyer", async () => {
      const result = await escrow.buyer(1);
      expect(result).to.be.equal(buyer.address);
    });

    it("Returns the purchase price", async () => {
      const result = await escrow.purchasePrice(1);
      expect(result).to.be.equal(tokens(10));
    });

    it("Returns the escrow amount", async () => {
      const result = await escrow.escrowAmount(1);
      expect(result).to.be.equal(tokens(5));
    });

    it("Reverts when other user wants to list", async () => {
      //   const tx = await escrow
      //     .connect(lender)
      //     .list(1, buyer.address, tokens(10), tokens(5));
      await expect(
        escrow.connect(lender).list(1, buyer.address, tokens(10), tokens(5))
      ).to.be.revertedWith("Only seller can call this method !");
    });
  });

  describe("Deposits", () => {
    it("Updates contract balance", async () => {
      const tx = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await tx.wait();

      const result = await escrow.getBalance();
      expect(result).to.be.equal(tokens(5));
    });
  });

  describe("Inspection", () => {
    it("Updates the inspection status", async () => {
      const tx = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await tx.wait();
      const results = await escrow.inspectionPassed(1);
      expect(results).to.be.equal(true);
    });
  });

  describe("Approval", () => {
    it("Updates approval status", async () => {
      let tx = await escrow.connect(buyer).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(seller).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(lender).approveSale(1);
      await tx.wait();

      expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
      expect(await escrow.approval(1, seller.address)).to.be.equal(true);
      expect(await escrow.approval(1, lender.address)).to.be.equal(true);
    });
  });

  describe("Sale", () => {
    beforeEach(async () => {
      let tx = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await tx.wait();

      tx = await escrow.connect(inspector).updateInspectionStatus(1, true);
      await tx.wait();

      tx = await escrow.connect(buyer).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(seller).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(lender).approveSale(1);
      await tx.wait();

      await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

      tx = await escrow.connect(seller).finalizeSale(1);
      await tx.wait();
    });

    it("Updates balance", async () => {
      expect(await escrow.getBalance()).to.be.equal(0);
    });

    it("Updates the ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
    });
  });
});
