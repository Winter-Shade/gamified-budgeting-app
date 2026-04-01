const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Use deployer as fee collector for now (can be changed later via setFeeCollector)
  const feeCollector = deployer.address;

  const Factory = await ethers.getContractFactory("CommitmentSavings");
  const contract = await Factory.deploy(feeCollector);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CommitmentSavings deployed to:", address);
  console.log("Fee collector:", feeCollector);

  // Save deployment info for the frontend
  const fs = require("fs");
  const deploymentInfo = {
    address,
    feeCollector,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
