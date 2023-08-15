### How to run:

1) Clone the repository and `cd` into it
2) `npm i`

Now open one more terminal and go into the repo folder.

3) fork the mainnet with hardhat using my free archive node rpc: `npx hardhat node --fork https://morning-spring-patina.discover.quiknode.pro/4dbc3a8b5e809a0082bd48d0e713e308f323cdc7/`
4) When the mainnet is up and running, in the second terminal run: `npx hardhat run scripts/deploy.ts`
5) When the deployment script has finished, run `cd frontend` and there launch a web server `python -m http.server` (or `python3 -m http.server`)

The web server app is going to tell you where the page is running, but most likely it's gonna be `http://localhost:8000/`.

Now all you have to do is open Google Chrome with Metamask extension installed and head to there

  - When re-forking the mainnet you will always have to wipe Metamask history/data for each account. Metamask -> select account -> three dots up right -> Settings -> Advanced -> Clear activity tab data
  - You can import the USDC token: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
