/* global it, jasmine, afterAll, beforeAll */
import { HDSegwitP2SHWallet, HDSegwitBech32Wallet } from './class';
global.crypto = require('crypto'); // shall be used by tests under nodejs CLI, but not in RN environment
let assert = require('assert');
let bitcoin = require('bitcoinjs-lib');
global.net = require('net'); // needed by Electrum client. For RN it is proviced in shim.js
let BlueElectrum = require('./BlueElectrum'); // so it connects ASAP

afterAll(() => {
  // after all tests we close socket so the test suite can actually terminate
  return BlueElectrum.forceDisconnect();
});

beforeAll(async () => {
  // awaiting for Electrum to be connected. For RN Electrum would naturally connect
  // while app starts up, but for tests we need to wait for it
  await BlueElectrum.waitTillConnected();
  console.log('electrum connected');
});

it('can create a Bech32 Segwit HD (BIP84)', async function() {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30 * 1000;
  let mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let hd = new HDSegwitBech32Wallet();
  hd.setSecret(mnemonic);

  assert.strictEqual(true, hd.validateMnemonic());
  assert.strictEqual(
    'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
    hd.getXpub(),
  );

  assert.strictEqual(hd._getExternalWIFByIndex(0), 'KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d');
  assert.strictEqual(hd._getExternalWIFByIndex(1), 'Kxpf5b8p3qX56DKEe5NqWbNUP9MnqoRFzZwHRtsFqhzuvUJsYZCy');
  assert.strictEqual(hd._getInternalWIFByIndex(0), 'KxuoxufJL5csa1Wieb2kp29VNdn92Us8CoaUG3aGtPtcF3AzeXvF');
  assert.ok(hd._getInternalWIFByIndex(0) !== hd._getInternalWIFByIndex(1));

  assert.strictEqual(hd._getExternalAddressByIndex(0), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  assert.strictEqual(hd._getExternalAddressByIndex(1), 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  assert.strictEqual(hd._getInternalAddressByIndex(0), 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');
  assert.ok(hd._getInternalAddressByIndex(0) !== hd._getInternalAddressByIndex(1));

  assert.ok(hd._lastBalanceFetch === 0);
  await hd.fetchBalance();
  assert.strictEqual(hd.getBalance(), 0);
  assert.ok(hd._lastBalanceFetch > 0);

  // checking that internal pointer and async address getter return the same address
  let freeAddress = await hd.getAddressAsync();
  assert.strictEqual(hd.next_free_address_index, 0);
  assert.strictEqual(hd._getExternalAddressByIndex(hd.next_free_address_index), freeAddress);
  let freeChangeAddress = await hd.getChangeAddressAsync();
  assert.strictEqual(hd.next_free_change_address_index, 0);
  assert.strictEqual(hd._getInternalAddressByIndex(hd.next_free_change_address_index), freeChangeAddress);
});

it.skip('Segwit HD (BIP49) can generate addressess only via ypub', function() {
  let ypub = 'ypub6WhHmKBmHNjcrUVNCa3sXduH9yxutMipDcwiKW31vWjcMbfhQHjXdyx4rqXbEtVgzdbhFJ5mZJWmfWwnP4Vjzx97admTUYKQt6b9D7jjSCp';
  let hd = new HDSegwitP2SHWallet();
  hd._xpub = ypub;
  assert.strictEqual('3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK', hd._getExternalAddressByIndex(0));
  assert.strictEqual('35p5LwCAE7mH2css7onyQ1VuS1jgWtQ4U3', hd._getExternalAddressByIndex(1));
  assert.strictEqual('32yn5CdevZQLk3ckuZuA8fEKBco8mEkLei', hd._getInternalAddressByIndex(0));
});

it.skip('can generate Segwit HD (BIP49)', async () => {
  let hd = new HDSegwitP2SHWallet();
  let hashmap = {};
  for (let c = 0; c < 1000; c++) {
    await hd.generate();
    let secret = hd.getSecret();
    if (hashmap[secret]) {
      throw new Error('Duplicate secret generated!');
    }
    hashmap[secret] = 1;
    assert.ok(secret.split(' ').length === 12 || secret.split(' ').length === 24);
  }

  let hd2 = new HDSegwitP2SHWallet();
  hd2.setSecret(hd.getSecret());
  assert.ok(hd2.validateMnemonic());
});

it.skip('HD (BIP49) can create TX', async () => {
  if (!process.env.HD_MNEMONIC) {
    console.error('process.env.HD_MNEMONIC not set, skipped');
    return;
  }
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 90 * 1000;
  let hd = new HDSegwitP2SHWallet();
  hd.setSecret(process.env.HD_MNEMONIC);
  assert.ok(hd.validateMnemonic());

  await hd.fetchUtxo();
  await hd.getChangeAddressAsync(); // to refresh internal pointer to next free address
  await hd.getAddressAsync(); // to refresh internal pointer to next free address
  let txhex = hd.createTx(hd.utxo, 0.000014, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  assert.strictEqual(
    txhex,
    '010000000001029d98d81fe2b596fd79e845fa9f38d7e0b6fb73303c40fac604d04df1fa137aee00000000171600142f18e8406c9d210f30c901b24e5feeae78784eb7ffffffff67fb86f310df24e508d40fce9511c7fde4dd4ee91305fd08a074279a70e2cd22000000001716001468dde644410cc789d91a7f36b823f38369755a1cffffffff02780500000000000017a914a3a65daca3064280ae072b9d6773c027b30abace87dc0500000000000017a914850f4dbc255654de2c12c6f6d79cf9cb756cad038702483045022100dc8390a9fd34c31259fa47f9fc182f20d991110ecfd5b58af1cf542fe8de257a022004c2d110da7b8c4127675beccc63b46fd65c706951f090fd381fa3b21d3c5c08012102edd141c5a27a726dda66be10a38b0fd3ccbb40e7c380034aaa43a1656d5f4dd60247304402207c0aef8313d55e72474247daad955979f62e56d1cbac5f2d14b8b022c6ce112602205d9aa3804f04624b12ab8a5ab0214b529c531c2f71c27c6f18aba6502a6ea0a80121030db3c49461a5e539e97bab62ab2b8f88151d1c2376493cf73ef1d02ef60637fd00000000',
  );

  txhex = hd.createTx(hd.utxo, 0.000005, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  var tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 1);
  assert.strictEqual(tx.outs.length, 2);
  assert.strictEqual(tx.outs[0].value, 500);
  assert.strictEqual(tx.outs[1].value, 400);
  let chunksIn = bitcoin.script.decompile(tx.outs[0].script);
  let toAddress = bitcoin.address.fromOutputScript(chunksIn);
  chunksIn = bitcoin.script.decompile(tx.outs[1].script);
  let changeAddress = bitcoin.address.fromOutputScript(chunksIn);
  assert.strictEqual('3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK', toAddress);
  assert.strictEqual(hd._getInternalAddressByIndex(hd.next_free_change_address_index), changeAddress);

  //

  txhex = hd.createTx(hd.utxo, 0.000015, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 2);
  assert.strictEqual(tx.outs.length, 2);

  //

  txhex = hd.createTx(hd.utxo, 0.00025, 0.00001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 7);
  assert.strictEqual(tx.outs.length, 1);
  chunksIn = bitcoin.script.decompile(tx.outs[0].script);
  toAddress = bitcoin.address.fromOutputScript(chunksIn);
  assert.strictEqual('3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK', toAddress);

  // checking that change amount is at least 3x of fee, otherwise screw the change, just add it to fee.
  // theres 0.00003 on UTXOs, lets transfer (0.00003 - 100sat), soo fee is equal to change (100 sat)
  // which throws @dust error if broadcasted
  txhex = hd.createTx(hd.utxo, 0.000028, 0.000001, '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK');
  tx = bitcoin.Transaction.fromHex(txhex);
  assert.strictEqual(tx.ins.length, 2);
  assert.strictEqual(tx.outs.length, 1); // only 1 output, which means change is neglected
  assert.strictEqual(tx.outs[0].value, 2800);
});

it.skip('Segwit HD (BIP49) can fetch UTXO', async function() {
  let hd = new HDSegwitP2SHWallet();
  hd.usedAddresses = ['1Ez69SnzzmePmZX3WpEzMKTrcBF2gpNQ55', '1BiTCHeYzJNMxBLFCMkwYXNdFEdPJP53ZV']; // hacking internals
  await hd.fetchUtxo();
  assert.strictEqual(hd.utxo.length, 11);
  assert.ok(typeof hd.utxo[0].confirmations === 'number');
  assert.ok(hd.utxo[0].txid);
  assert.ok(hd.utxo[0].vout);
  assert.ok(hd.utxo[0].amount);
  assert.ok(
    hd.utxo[0].address &&
      (hd.utxo[0].address === '1Ez69SnzzmePmZX3WpEzMKTrcBF2gpNQ55' || hd.utxo[0].address === '1BiTCHeYzJNMxBLFCMkwYXNdFEdPJP53ZV'),
  );
});

it.skip('Segwit HD (BIP49) can fetch balance with many used addresses in hierarchy', async function() {
  if (!process.env.HD_MNEMONIC_BIP49_MANY_TX) {
    console.error('process.env.HD_MNEMONIC_BIP49_MANY_TX not set, skipped');
    return;
  }

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 90 * 1000;
  let hd = new HDSegwitP2SHWallet();
  hd.setSecret(process.env.HD_MNEMONIC_BIP49_MANY_TX);
  assert.ok(hd.validateMnemonic());
  let start = +new Date();
  await hd.fetchBalance();
  let end = +new Date();
  const took = (end - start) / 1000;
  took > 15 && console.warn('took', took, "sec to fetch huge HD wallet's balance");
  assert.strictEqual(hd.getBalance(), 0.00051432);

  await hd.fetchUtxo();
  assert.ok(hd.utxo.length > 0);

  await hd.fetchTransactions();
  assert.strictEqual(hd.getTransactions().length, 107);
});

it.skip('can work with malformed mnemonic', () => {
  let mnemonic =
    'honey risk juice trip orient galaxy win situate shoot anchor bounce remind horse traffic exotic since escape mimic ramp skin judge owner topple erode';
  let hd = new HDSegwitP2SHWallet();
  hd.setSecret(mnemonic);
  let seed1 = hd.getMnemonicToSeedHex();
  assert.ok(hd.validateMnemonic());

  mnemonic = 'hell';
  hd = new HDSegwitP2SHWallet();
  hd.setSecret(mnemonic);
  assert.ok(!hd.validateMnemonic());

  // now, malformed mnemonic

  mnemonic =
    '    honey  risk   juice    trip     orient      galaxy win !situate ;; shoot   ;;;   anchor Bounce remind\nhorse \n traffic exotic since escape mimic ramp skin judge owner topple erode ';
  hd = new HDSegwitP2SHWallet();
  hd.setSecret(mnemonic);
  let seed2 = hd.getMnemonicToSeedHex();
  assert.strictEqual(seed1, seed2);
  assert.ok(hd.validateMnemonic());
});
