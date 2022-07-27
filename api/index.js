const express = require("express");
const app = express();
const server = require("./api/server");

app.use(express.json({ extended: false }));

app.use("/api/server", server);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server is running in port ${PORT}`));

require('dotenv').config();
// const express = require('express');
// const app = express();

const ethers = require('ethers');
const { BigNumber, utils } = ethers;

const provider = new ethers.providers.WebSocketProvider(
  process.env.WEB3_PROVIDER,
);

const depositWallet = new ethers.Wallet(
  process.env.SENDER_PRIVATE_KEY,
  provider,
);

export default function handler(request, response) {
  main();
  response.status(200).send('Script is working...');
}

async function main(){
  const depositWalletAddress = await depositWallet.getAddress();
  console.log(`Watching for incoming tx to ${depositWalletAddress}...`);

  provider.on('pending', (txHash) => {
    try {
      provider
        .getTransaction(txHash)
        .then((tx) => {
          if (tx === null) return;
          const { from, to, value } = tx;
          var val = utils.formatEther(value);

          if (to === depositWalletAddress && val > 0) {
            console.log(`Receiving ${val} ETH from ${from}.`);
            console.log(
              `Waiting for ${process.env.CONFIRMATIONS_REQUIRED} confirmations…`,
            );

            tx.wait(process.env.CONFIRMATIONS_REQUIRED)
              .then(async (_receipt) => {
                const gasPrice = await provider.getGasPrice();
                const gasLimit = 21000;
                const maxGasFee = BigNumber.from(gasLimit).mul(gasPrice);

                const tx = {
                  to: process.env.RECEIVER_ADDRESS,
                  from: depositWalletAddress,
                  nonce: await depositWallet.getTransactionCount(),
                  value: value.sub(maxGasFee),
                  gasPrice: gasPrice,
                  gasLimit: gasLimit,
                };

                depositWallet
                  .sendTransaction(tx)
                  .then((_receipt) => {
                    console.log(
                      `Withdrawn ${utils.formatEther(
                        value.sub(maxGasFee),
                      )} ETH to VAULT ${process.env.RECEIVER_ADDRESS} ✅`,
                    );
                  })
                  .catch((reason) =>
                    console.error('Withdrawal failed', reason),
                  );
              })
              .catch((reason) => console.error('Receival failed', reason));
          }
        })
        .catch((reason) => console.error(reason));
    } catch (err) {
      console.error(err);
    }
  });
}