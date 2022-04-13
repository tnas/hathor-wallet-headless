/**
 * @typedef WalletInstanceBenchmark
 * @property {string} walletId
 * @property {boolean} [isMultisig]
 * @property {number} [startRequestTime]
 * @property {number} [startResponseTime]
 * @property {number} [startDuration] Milisseconds to receive response on `/start`
 * @property {number} [walletReadyTime]
 * @property {number} [walletReadyDuration] Milisseconds from request `/start` to `/status` ready
 */

import { loggers } from '../logger.util';

/**
 * List of wallet instances that were started
 * @type {Record<string, WalletInstanceBenchmark>}
 */
const instances = {};

function getOrInitInstance(walletId, isMultisig = false) {
  if (instances[walletId]) {
    return instances[walletId];
  }

  const walletObj = {
    walletId,
  };
  if (isMultisig) walletObj.isMultisig = true;
  instances[walletId] = walletObj;
  return walletObj;
}

/**
 * Wallet initialization events
 * @readonly
 * @enum {string}
 */
export const WALLET_EVENTS = {
  startRequest: 'startRequest',
  startResponse: 'startResponse',
  confirmedReady: 'confirmedReady',
};

export class WalletBenchmarkUtil {
  /**
   * Inform a wallet event
   * @param {string} walletId
   * @param {string} event Type of event, from WALLET_EVENTS list
   * @param [options]
   * @param {boolean} [options.multisig] Inform if this is a multisig wallet
   */
  static informWalletEvent(walletId, event, options = {}) {
    const walletObj = getOrInitInstance(walletId, options.multisig);

    switch (event) {
      case WALLET_EVENTS.startRequest:
        walletObj.startRequestTime = Date.now().valueOf();
        break;
      case WALLET_EVENTS.startResponse:
        walletObj.startResponseTime = Date.now().valueOf();
        walletObj.startDuration = walletObj.startResponseTime - walletObj.startRequestTime;
        break;
      case WALLET_EVENTS.confirmedReady:
        walletObj.walletReadyTime = Date.now().valueOf();
        walletObj.walletReadyDuration = walletObj.walletReadyTime - walletObj.startRequestTime;
        break;
      default:
        console.warn(`Unknown wallet event: ${event}`);
    }
  }

  static calculateSummary(walletIds) {
    const summary = {
      avgStartResponseTime: 0,
      avgReadyTime: 0,
      avgStartResponseTimeMultisig: 0,
      avgReadyTimeMultisig: 0,
      startedWallets: 0,
    };
    let sumResponseTime = 0;
    let sumReadyTime = 0;
    let sumResponseTimeMultisig = 0;
    let sumReadyTimeMultisig = 0;

    const allInstanceIds = Object.keys(instances);
    const filteredInstanceIds = walletIds
      ? allInstanceIds.filter(i => walletIds.includes(i)) // Filter only by the informed parameter
      : allInstanceIds; // Retrieve all wallets
    let amountOfWallets = 0;
    let amountOfWalletsMultisig = 0;

    for (const walletId of filteredInstanceIds) {
      const wallet = instances[walletId];
      if (wallet.isMultisig) {
        ++amountOfWalletsMultisig;
        sumResponseTimeMultisig += wallet.startDuration;
        sumReadyTimeMultisig += wallet.walletReadyDuration;
      } else {
        ++amountOfWallets;
        sumResponseTime += wallet.startDuration;
        sumReadyTime += wallet.walletReadyDuration;
      }
    }

    summary.avgStartResponseTimeMultisig = sumResponseTimeMultisig / amountOfWalletsMultisig;
    summary.avgReadyTimeMultisig = sumReadyTimeMultisig / amountOfWalletsMultisig;
    summary.avgStartResponseTime = sumResponseTime / amountOfWallets;
    summary.avgReadyTime = sumReadyTime / amountOfWallets;
    summary.startedWallets = amountOfWallets + amountOfWalletsMultisig;

    return {
      ...summary,
      wallets: instances
    };
  }

  static async logResults() {
    loggers.walletBenchmark.insertLineToLog('Will start results');
    for (const walletId in instances) {
      const metadata = { wallet: instances[walletId] };
      loggers.walletBenchmark.insertLineToLog('Wallet instance', metadata);
      await delay(0);
    }
  }
}

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
