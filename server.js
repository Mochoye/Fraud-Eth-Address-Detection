const express = require("express");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");
const path = require("path");

// ✅ Correct order: first define `app`, then use it
const app = express();



const PORT = 3000;

app.use(cors()); // optional open CORS
// app.use(cors({ origin: "http://127.0.0.1:5500" })); // optional restricted CORS
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.ETHERSCAN_API_KEY;
const API = "https://api.etherscan.io/api";

// Convert Wei to Ether
const toEth = (wei) => parseFloat(wei) / 1e18;

// Helper: Fetch transactions
const fetchTxs = async (address, action) => {
  const res = await axios.get(API, {
    params: {
      module: "account",
      action,
      address,
      startblock: 0,
      endblock: 99999999,
      sort: "asc",
      apikey: API_KEY,
    },
  });
  return res.data.result || [];
};

const getFeatures = async (address) => {
  address = address.toLowerCase();
  const normalTxs = await fetchTxs(address, "txlist");
  const internalTxs = await fetchTxs(address, "txlistinternal");
  const tokenTxs = await fetchTxs(address, "tokentx");

  const sentTxs = normalTxs.filter(tx => tx.from.toLowerCase() === address);
  const recTxs = normalTxs.filter(tx => tx.to?.toLowerCase() === address);

  const allTimestamps = normalTxs.map(tx => parseInt(tx.timeStamp));
  const sentTimestamps = sentTxs.map(tx => parseInt(tx.timeStamp));
  const recTimestamps = recTxs.map(tx => parseInt(tx.timeStamp));

  const avgDelta = (timestamps) => {
    if (timestamps.length < 2) return 0;
    return (timestamps[timestamps.length - 1] - timestamps[0]) / 60 / (timestamps.length - 1);
  };

  const valueStats = (txs) => {
    const values = txs.map(tx => toEth(tx.value));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    };
  };

  const erc20Sent = tokenTxs.filter(tx => tx.from.toLowerCase() === address);
  const erc20Rec = tokenTxs.filter(tx => tx.to?.toLowerCase() === address);

  const tokenValStats = (txs) => {
    const values = txs.map(tx => toEth(tx.value));
    return {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    };
  };

  const balanceRes = await axios.get(API, {
    params: {
      module: "account",
      action: "balance",
      address,
      tag: "latest",
      apikey: API_KEY,
    },
  });
  const balance = toEth(balanceRes.data.result || "0");

  return {
    // 2-4
    avg_min_between_sent_tnx: avgDelta(sentTimestamps),
    avg_min_between_received_tnx: avgDelta(recTimestamps),
    time_diff_between_first_last: allTimestamps.length ? (Math.max(...allTimestamps) - Math.min(...allTimestamps)) / 60 : 0,

    // 5-9
    sent_tnx: sentTxs.length,
    received_tnx: recTxs.length,
    number_of_created_contracts: internalTxs.filter(tx => tx.contractAddress).length,
    unique_received_from_addresses: new Set(recTxs.map(tx => tx.from)).size,
    unique_sent_to_addresses: new Set(sentTxs.map(tx => tx.to)).size,

    // 10-15
    min_value_received: valueStats(recTxs).min,
    max_value_received: valueStats(recTxs).max,
    avg_value_received: valueStats(recTxs).avg,
    min_value_sent: valueStats(sentTxs).min,
    max_value_sent: valueStats(sentTxs).max,
    avg_value_sent: valueStats(sentTxs).avg,

    // 16-20
    total_transactions: normalTxs.length,
    total_ether_sent: sentTxs.reduce((acc, tx) => acc + toEth(tx.value), 0),
    total_ether_received: recTxs.reduce((acc, tx) => acc + toEth(tx.value), 0),
    total_ether_sent_contracts: internalTxs.reduce((acc, tx) => acc + toEth(tx.value), 0),
    total_ether_balance: balance,

    // 21-28
    total_erc20_txns: tokenTxs.length,
    erc20_total_ether_received: erc20Rec.reduce((acc, tx) => acc + toEth(tx.value), 0),
    erc20_total_ether_sent: erc20Sent.reduce((acc, tx) => acc + toEth(tx.value), 0),
    erc20_total_ether_sent_contracts: 0, // Optional refinement
    erc20_uniq_sent_addr: new Set(erc20Sent.map(tx => tx.to)).size,
    erc20_uniq_rec_addr: new Set(erc20Rec.map(tx => tx.from)).size,
    erc20_uniq_sent_addr_1: new Set(erc20Sent.map(tx => tx.from)).size,
    erc20_uniq_rec_contract_addr: new Set(erc20Rec.map(tx => tx.contractAddress)).size,

    // 29-34
    erc20_min_val_rec: tokenValStats(erc20Rec).min,
    erc20_max_val_rec: tokenValStats(erc20Rec).max,
    erc20_avg_val_rec: tokenValStats(erc20Rec).avg,
    erc20_min_val_sent: tokenValStats(erc20Sent).min,
    erc20_max_val_sent: tokenValStats(erc20Sent).max,
    erc20_avg_val_sent: tokenValStats(erc20Sent).avg,

    // 35-36
    erc20_uniq_sent_token_name: new Set(erc20Sent.map(tx => tx.tokenName)).size,
    erc20_uniq_rec_token_name: new Set(erc20Rec.map(tx => tx.tokenName)).size,

    // 37 - Most received token type
    erc20_most_rec_token_type: (() => {
      const count = {};
      for (let tx of erc20Rec) {
        count[tx.tokenName] = (count[tx.tokenName] || 0) + 1;
      }
      const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
      return sorted.length ? sorted[0][0] : "None";
    })(),
  };
};

// Route
app.get("/features/:address", async (req, res) => {
  try {
    const features = await getFeatures(req.params.address);
    res.json(features);
  } catch (err) {
    res.status(500).json({ error: "Failed to extract features", message: err.message });
  }
});

const { spawn } = require("child_process");

// Route for prediction
app.get("/predict/:address", async (req, res) => {
  try {
    const features = await getFeatures(req.params.address);

    const python = spawn("python", ["predict.py"]);

    let output = "";
    let error = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Prediction failed", message: error });
      }
      try {
        const result = JSON.parse(output);
        res.json(result);
      } catch (parseErr) {
        res.status(500).json({ error: "Failed to parse prediction output", message: parseErr.message });
      }
    });

    // Send features to Python script via stdin
    python.stdin.write(JSON.stringify(features));
    python.stdin.end();
  } catch (err) {
    res.status(500).json({ error: "Feature extraction failed", message: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
