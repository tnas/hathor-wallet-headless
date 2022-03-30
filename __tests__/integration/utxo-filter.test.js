import { TestUtils, WALLET_CONSTANTS } from './utils/test-utils-integration';
import { WalletHelper } from './utils/wallet-helper';

describe('utxo-filter routes', () => {
  /** @type WalletHelper */
  let wallet1;
  let wallet2;

  const tokenA = {
    name: 'Token A',
    symbol: 'TKA',
    uid: ''
  };

  const transactions = {
    tx10: { hash: '', address: '', index: 0 },
    tx20: { hash: '', address: '', index: 0 },
    tx30: { hash: '', address: '', index: 0 },
    tx40: { hash: '', address: '', index: 0 },
    tx50: { hash: '', address: '', index: 0 },
  };

  beforeAll(async () => {
    try {
      // First wallet, no balance
      wallet1 = new WalletHelper('utxo-filter-1');
      // Second wallet, with custom token
      wallet2 = new WalletHelper('utxo-filter-2');

      await WalletHelper.startMultipleWalletsForTest([wallet1, wallet2]);

      await wallet2.injectFunds(20, 0);
      await TestUtils.pauseForWsUpdate();

      const tkaTx = await wallet2.createToken({
        name: tokenA.name,
        symbol: tokenA.symbol,
        amount: 1000,
        change_address: await wallet2.getAddressAt(0),
        address: await wallet2.getAddressAt(1)
      });
      tokenA.uid = tkaTx.hash;

      /*
       * Wallet1: empty
       * Wallet2:
       * - addr0: 10 htr
       * - addr1: 1000 tka
       */

      await TestUtils.pauseForWsUpdate();
    } catch (err) {
      TestUtils.logError(err.stack);
    }
  });

  afterAll(async () => {
    await wallet1.stop();
    await wallet2.stop();
  });

  function assertAllEmpty(utxoResponse) {
    expect(utxoResponse.total_amount_available).toBe(0);
    expect(utxoResponse.total_utxos_available).toBe(0);
    expect(utxoResponse.total_amount_locked).toBe(0);
    expect(utxoResponse.total_utxos_locked).toBe(0);
    expect(utxoResponse.utxos).toHaveProperty('length', 0);
  }

  it('should return empty results for an empty wallet', async done => {
    const utxosObj = await wallet1.getUtxos();

    assertAllEmpty(utxosObj);
    done();
  });

  it('should return empty results for an empty wallet (custom token)', async done => {
    const utxosObj = await wallet1.getUtxos({
      token: tokenA.uid
    });

    assertAllEmpty(utxosObj);
    done();
  });

  it('should return empty results for an empty address', async done => {
    const utxosObj = await wallet2.getUtxos({
      filter_address: await wallet2.getAddressAt(1)
    });

    assertAllEmpty(utxosObj);
    done();
  });

  it('should return empty results for an empty address (custom token)', async done => {
    const utxosObj = await wallet2.getUtxos({
      token: tokenA.uid,
      filter_address: await wallet2.getAddressAt(0)
    });

    assertAllEmpty(utxosObj);
    done();
  });

  it('should return single utxo', async done => {
    const addr0Hash = await wallet2.getAddressAt(0);
    const utxosObj = await wallet2.getUtxos();

    expect(utxosObj.total_amount_available).toBe(10);
    expect(utxosObj.total_utxos_available).toBe(1);
    expect(utxosObj.total_amount_locked).toBe(0);
    expect(utxosObj.total_utxos_locked).toBe(0);
    expect(utxosObj.utxos).toHaveProperty('length', 1);

    const utxo = utxosObj.utxos[0];
    expect(utxo.address).toBe(addr0Hash);
    expect(utxo.amount).toBe(10);
    expect(utxo.tx_id).toBe(tokenA.uid);
    expect(utxo.locked).toBe(false);
    done();
  });

  it('should return single utxo (custom token)', async done => {
    const addr1Hash = await wallet2.getAddressAt(1);
    const utxosObj = await wallet2.getUtxos({
      token: tokenA.uid,
    });

    expect(utxosObj.total_amount_available).toBe(1000);
    expect(utxosObj.total_utxos_available).toBe(1);
    expect(utxosObj.total_amount_locked).toBe(0);
    expect(utxosObj.total_utxos_locked).toBe(0);
    expect(utxosObj.utxos).toHaveProperty('length', 1);

    const utxo = utxosObj.utxos[0];
    expect(utxo.address).toBe(addr1Hash);
    expect(utxo.amount).toBe(1000);
    expect(utxo.tx_id).toBe(tokenA.uid);
    expect(utxo.locked).toBe(false);
    done();
  });

  // This test spreads out TKA on many UTXOs, as described in the `transactions` variable.
  it('should return with filter max_utxos', async done => {
    const addr0 = await wallet2.getAddressAt(0);
    transactions.tx10.address = await wallet2.getNextAddress(true);
    transactions.tx20.address = await wallet2.getNextAddress(true);
    transactions.tx30.address = await wallet2.getNextAddress(true);
    transactions.tx40.address = await wallet2.getNextAddress(true);
    transactions.tx50.address = await wallet2.getNextAddress(true);
    let remainingChange = 1000;

    try {
      const tx10 = await wallet2.sendTx({
        fullObject: {
          outputs: [
            { address: transactions.tx10.address, value: 10, token: tokenA.uid }
          ]
        },
        change_address: addr0
      });
      transactions.tx10.hash = tx10.hash;
      transactions.tx10.index = TestUtils.getOutputIndexFromTx(tx10, 10);
      remainingChange -= 10;
      await TestUtils.pauseForWsUpdate();

      const tx20 = await wallet2.sendTx({
        fullObject: {
          inputs: [{
            hash: tx10.hash,
            index: TestUtils.getOutputIndexFromTx(tx10, remainingChange)
          }],
          outputs: [
            { address: transactions.tx20.address, value: 20, token: tokenA.uid }
          ]
        },
        change_address: addr0
      });
      transactions.tx20.hash = tx20.hash;
      transactions.tx20.index = TestUtils.getOutputIndexFromTx(tx20, 20);
      remainingChange -= 20;
      await TestUtils.pauseForWsUpdate();

      const tx30 = await wallet2.sendTx({
        fullObject: {
          inputs: [{
            hash: tx20.hash,
            index: TestUtils.getOutputIndexFromTx(tx20, remainingChange)
          }],
          outputs: [
            { address: transactions.tx30.address, value: 30, token: tokenA.uid }
          ]
        },
        change_address: addr0
      });
      transactions.tx30.hash = tx30.hash;
      transactions.tx30.index = TestUtils.getOutputIndexFromTx(tx30, 30);
      remainingChange -= 30;
      await TestUtils.pauseForWsUpdate();

      const tx40 = await wallet2.sendTx({
        fullObject: {
          inputs: [{
            hash: tx30.hash,
            index: TestUtils.getOutputIndexFromTx(tx30, remainingChange)
          }],
          outputs: [
            { address: transactions.tx40.address, value: 40, token: tokenA.uid }
          ]
        },
        change_address: addr0
      });
      transactions.tx40.hash = tx40.hash;
      transactions.tx40.index = TestUtils.getOutputIndexFromTx(tx40, 40);
      remainingChange -= 40;
      await TestUtils.pauseForWsUpdate();

      const tx50 = await wallet2.sendTx({
        fullObject: {
          inputs: [{
            hash: tx40.hash,
            index: TestUtils.getOutputIndexFromTx(tx40, remainingChange)
          }],
          outputs: [
            { address: transactions.tx50.address, value: 50, token: tokenA.uid }
          ]
        },
        change_address: addr0
      });
      transactions.tx50.hash = tx50.hash;
      transactions.tx50.index = TestUtils.getOutputIndexFromTx(tx50, 50);
    } catch (err) {
      await TestUtils.pauseForWsUpdate();
      await TestUtils.dumpUtxos({
        walletId: wallet2.walletId,
        token: tokenA.uid,
        err
      });
    }

    await TestUtils.pauseForWsUpdate();

    const utxosObj = await wallet2.getUtxos({
      token: tokenA.uid,
      max_utxos: 2
    });

    expect(utxosObj.utxos).toHaveProperty('length', 2);
    expect(utxosObj.total_amount_available).toBe(30);
    expect(utxosObj.total_utxos_available).toBe(2);
    expect(utxosObj.total_amount_locked).toBe(0);
    expect(utxosObj.total_utxos_locked).toBe(0);

    const utxo0 = utxosObj.utxos[0];
    expect(utxo0.address).toBe(transactions.tx10.address);
    expect(utxo0.amount).toBe(10);
    expect(utxo0.locked).toBe(false);

    const utxo1 = utxosObj.utxos[1];
    expect(utxo1.address).toBe(transactions.tx20.address);
    expect(utxo1.amount).toBe(20);
    expect(utxo1.locked).toBe(false);
    done();
  });

  it('should return results for specific addresses', async done => {
    const htrUtxos = await wallet2.getUtxos({ filter_address: await wallet2.getAddressAt(0) });
    const tkaUtxos = await wallet2.getUtxos({
      filter_address: transactions.tx20.address,
      token: tokenA.uid
    });

    // HTR
    expect(htrUtxos.total_amount_available).toBe(10);
    expect(htrUtxos.total_utxos_available).toBe(1);
    expect(htrUtxos.utxos).toHaveProperty('length', 1);
    expect(htrUtxos.utxos[0]).toHaveProperty('tx_id', tokenA.uid);

    // TKA
    expect(tkaUtxos.total_amount_available).toBe(20);
    expect(tkaUtxos.total_utxos_available).toBe(1);
    expect(tkaUtxos.utxos).toHaveProperty('length', 1);
    expect(tkaUtxos.utxos[0]).toHaveProperty('tx_id', transactions.tx20.hash);
    expect(tkaUtxos.utxos[0]).toHaveProperty('index', transactions.tx20.index);
    done();
  });

  it('should return correct results for amount_smaller_than', async done => {
    const tkaUtxos = await wallet2.getUtxos({
      token: tokenA.uid,
      amount_smaller_than: 30
    });

    // TODO: This is returning the equivalent of "smaller_or_equal_than". Is this correct?
    expect(tkaUtxos.total_amount_available).toBe(10 + 20 + 30);
    expect(tkaUtxos.total_utxos_available).toBe(3);
    expect(tkaUtxos.utxos).toHaveProperty('length', 3);
    expect(tkaUtxos.utxos[0]).toHaveProperty('tx_id', transactions.tx10.hash);
    expect(tkaUtxos.utxos[1]).toHaveProperty('tx_id', transactions.tx20.hash);
    expect(tkaUtxos.utxos[2]).toHaveProperty('tx_id', transactions.tx30.hash);
    done();
  });

  it('should return correct results for amount_bigger_than', async done => {
    const tkaUtxos = await wallet2.getUtxos({
      token: tokenA.uid,
      amount_bigger_than: 30
    });

    // TODO: This is returning the equivalent of "bigger_or_equal_than". Is this correct?
    expect(tkaUtxos.total_amount_available).toBe(1000 - 10 - 20);
    expect(tkaUtxos.total_utxos_available).toBe(4);
    expect(tkaUtxos.utxos).toHaveProperty('length', 4);
    expect(tkaUtxos.utxos[0]).toHaveProperty('tx_id', transactions.tx30.hash);
    expect(tkaUtxos.utxos[1]).toHaveProperty('tx_id', transactions.tx40.hash);
    expect(tkaUtxos.utxos[2]).toHaveProperty('tx_id', transactions.tx50.hash);
    expect(tkaUtxos.utxos[3]).toHaveProperty('tx_id', transactions.tx50.hash);

    /*
     * Tx50 was the last executed transaction, so it has two outputs: 50 tka for one address
     * and the remaining change for address 0. The order that the UTXOs from tx50 appear are not
     * consistent, so we make a simple check to solve this.
     */
    const tkaChangeOnAddr0 = 1000 - 10 - 20 - 30 - 40 - 50;
    if (tkaUtxos.utxos[2].amount === 50) {
      expect(tkaUtxos.utxos[3]).toHaveProperty('amount', tkaChangeOnAddr0);
    } else {
      expect(tkaUtxos.utxos[2]).toHaveProperty('amount', tkaChangeOnAddr0);
      expect(tkaUtxos.utxos[3]).toHaveProperty('amount', 50);
    }
    done();
  });

  it('should return correct results for maximum_amount', async done => {
    const tkaUtxos = await wallet2.getUtxos({
      token: tokenA.uid,
      maximum_amount: 100
    });

    expect(tkaUtxos.total_amount_available).toBe(100);
    expect(tkaUtxos.total_utxos_available).toBe(4);
    expect(tkaUtxos.utxos).toHaveProperty('length', 4);

    // We expect these UTXOs to be in the same order as a normal query.
    expect(tkaUtxos.utxos[0]).toHaveProperty('tx_id', transactions.tx10.hash);
    expect(tkaUtxos.utxos[1]).toHaveProperty('tx_id', transactions.tx20.hash);
    expect(tkaUtxos.utxos[2]).toHaveProperty('tx_id', transactions.tx30.hash);
    expect(tkaUtxos.utxos[3]).toHaveProperty('tx_id', transactions.tx40.hash);

    done();
  });

  it('should return correct results for maximum_amount and bigger_than', async done => {
    const tkaUtxos = await wallet2.getUtxos({
      token: tokenA.uid,
      maximum_amount: 100,
      amount_bigger_than: 30
    });

    expect(tkaUtxos.total_amount_available).toBe(70);
    expect(tkaUtxos.total_utxos_available).toBe(2);
    expect(tkaUtxos.utxos).toHaveProperty('length', 2);

    expect(tkaUtxos.utxos[0]).toHaveProperty('tx_id', transactions.tx30.hash);
    expect(tkaUtxos.utxos[1]).toHaveProperty('tx_id', transactions.tx40.hash);

    done();
  });

  // It seems there is a name mismatch on the lib parameter: only_available => only_available_utxos
  it.skip('should return correct results for only_available', async done => {
    /*
     * The miner wallet always has some locked utxos because of the mining.
     * There is a small chance that between each request a new block reward has been delivered,
     * so we will execute the two necessary requests in the shortest period to minimize this risk.
     */
    const minerWallet = new WalletHelper(
      WALLET_CONSTANTS.miner.walletId,
      WALLET_CONSTANTS.miner.words
    );
    await WalletHelper.startMultipleWalletsForTest([minerWallet]);

    const [utxos, availableUtxos] = await Promise.all([
      TestUtils.getUtxos({ walletId: minerWallet.walletId }),
      TestUtils.getUtxos({ walletId: minerWallet.walletId, only_available: true }),
    ]);

    // First analyzing the available amounts, which should be equal
    expect(utxos.total_amount_available).toBe(availableUtxos.total_amount_available);
    expect(utxos.total_utxos_available).toBe(availableUtxos.total_utxos_available);

    // The locked amounts should be removed from the "onlyAvailable" requests
    expect(utxos.total_amount_locked).toBeGreaterThan(0);
    expect(utxos.total_utxos_locked).toBeGreaterThan(0);
    expect(availableUtxos.total_amount_locked).toBe(0);
    expect(availableUtxos.total_utxos_locked).toBe(0);

    // Measuring locked utxos
    const lockedUtxos = utxos.utxos.filter(u => u.locked === true);
    expect(lockedUtxos.length).toBe(utxos.total_utxos_locked);
    const lockedAvailableUtxos = availableUtxos.utxos.filter(u => u.locked === true);
    expect(lockedAvailableUtxos.length).toBe(availableUtxos.total_utxos_locked);
    done();
  });
});