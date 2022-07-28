require('dotenv').config();
var cronJob = require('cron').CronJob;
const ethers = require('ethers');
const { BigNumber, utils } = ethers;

const provider = new ethers.providers.WebSocketProvider(
  process.env.WEB3_PROVIDER,
);

const depositWallet = new ethers.Wallet(
  process.env.SENDER_PRIVATE_KEY,
  provider,
);

var prevBalance = 0;

var cronJ1 = new cronJob(
  `*/${process.env.TIME_LIMIT} * * * * *`,
  async function () {
    main();
  },
  undefined,
  true,
  'GMT',
);

const main = async () => {
  try {
    var depositWalletAddress = await depositWallet.getAddress();
    var currentBalance = await depositWallet.getBalance();
    var currentBalanceInETH = utils.formatEther(currentBalance);
    console.log(
      `Checking balance for ${depositWalletAddress} => ${currentBalanceInETH} ETH`,
    );

    if (currentBalanceInETH > 0 && currentBalanceInETH !== prevBalance) {
      prevBalance = currentBalanceInETH;
      var gasPrice = await provider.getGasPrice();
      var gasLimit = 21000;
      var maxGasFee = BigNumber.from(gasLimit).mul(gasPrice);
      var value = currentBalance.sub(maxGasFee);
      if (utils.formatEther(value) > 0) {
        var tx = {
          to: process.env.RECEIVER_ADDRESS,
          from: depositWalletAddress,
          nonce: await depositWallet.getTransactionCount(),
          value: value,
          gasPrice: gasPrice,
          gasLimit: gasLimit,
        };
        depositWallet
          .sendTransaction(tx)
          .then(async(_receipt) => {
            await _receipt.wait();
            prevBalance = 0;
            console.log(
              `Withdrawn ${utils.formatEther(value)} ETH to VAULT ${
                process.env.RECEIVER_ADDRESS
              } ✅`,
            );
          })
          .catch((reason) => console.error('Withdrawal failed', reason));
      } else {
        console.log('ERROR: Not enough balance to pay gas fees...');
      }
    }
  } catch (err) {
    console.log(err);
  }
};

if (require.main === module) {
  cronJ1.start();
}
