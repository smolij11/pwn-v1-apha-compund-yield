import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.16",
  networks: {
    hardhat: {
      forking: {
        url: "https://morning-spring-patina.discover.quiknode.pro/4dbc3a8b5e809a0082bd48d0e713e308f323cdc7/",
      }
    }
  }
};

export default config;
