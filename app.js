// เปลี่ยนค่านี้เมื่อ deploy Bank ไปยัง address ใหม่บน Sepolia
const CONTRACT_ADDRESS = "0x3a3d53F6f28115f26Acefe6787Ef5016f2659fa4";

const ABI = [
  "function deposit() public payable",
  "function withdraw(uint256 amount) public",
  "function checkBlance() public view returns (uint256 balance)",
  "event Deposit(address indexed owner, uint256 amount)",
  "event Withdraw(address indexed owner, uint256 amount)"
];

const SEPOLIA_CHAIN_ID = 11155111n;
const INFURA_RPC_BASE = "https://sepolia.infura.io/v3/";
// ใส่ Private Key ของกระเป๋าทดสอบ Sepolia ที่นี่ (มีหรือไม่มี 0x ก็ได้)
// คีย์ใน JavaScript อ่านได้จากเบราว์เซอร์ ห้ามใช้กระเป๋าที่มีเงินจริง
// อย่า commit หรือเผยแพร่ไฟล์นี้หลังใส่คีย์จริง
const PRIVATE_KEY = "ds";
const EXPLORER = "https://sepolia.etherscan.io";

let provider;
let contract;

const $ = (id) => document.getElementById(id);

function short(value, start = 6, end = 4) {
  return value.slice(0, start) + "..." + value.slice(-end);
}

function setStatus(message, type = "", link = "") {
  const status = $("status");
  status.className = "status " + type;
  status.textContent = "สถานะ: " + message;

  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = " ดูบน Etherscan ↗";
    status.appendChild(anchor);
  }
}

function errMsg(error) {
  if (error.code === "INSUFFICIENT_FUNDS") {
    return "Sepolia ETH ในกระเป๋าไม่พอสำหรับธุรกรรมและค่า gas";
  }
  if (error.reason === "not enough money") {
    return "ยอดเงินในสัญญาไม่พอสำหรับถอน";
  }
  return "กรุณาตรวจยอดและการเชื่อมต่อ Infura แล้วลองอีกครั้ง";
}

function showContractLink() {
  const link = $("contractLink");
  link.textContent = short(CONTRACT_ADDRESS);
  link.href = EXPLORER + "/address/" + CONTRACT_ADDRESS;
}

function addHistory(type, amountEth, hash) {
  $("historyBox").classList.remove("hidden");

  const item = document.createElement("li");
  const isDeposit = type === "Deposit";
  const details = document.createElement("span");

  const label = document.createElement("span");
  label.className = "type " + (isDeposit ? "dep" : "wd");
  label.textContent = isDeposit ? "ฝาก" : "ถอน";

  const amount = document.createElement("span");
  amount.className = "amt";
  amount.textContent = amountEth + " ETH";
  details.append(label, amount);

  const link = document.createElement("a");
  link.href = EXPLORER + "/tx/" + hash;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = short(hash, 8, 6) + " ↗";

  item.append(details, link);
  $("history").prepend(item);
}

function disconnect() {
  provider.destroy();
  provider = null;
  contract = null;

  $("account").textContent = "-";
  $("network").textContent = "-";
  $("balance").textContent = "-";
  $("history").replaceChildren();
  $("historyBox").classList.add("hidden");
  $("btnConnect").textContent = "เชื่อมต่อ Infura";
  $("infuraKey").disabled = false;
  setStatus("ตัดการเชื่อมต่อแล้ว");
}

async function connectInfura() {
  if (contract) {
    disconnect();
    return;
  }

  const projectId = $("infuraKey").value.trim();
  const privateKey = PRIVATE_KEY.trim().replace(/^0x/i, "");

  if (!/^[a-f0-9]{32}$/i.test(projectId)) {
    setStatus("กรอก Infura Project ID จำนวน 32 ตัวอักษร", "err");
    return;
  }
  if (!/^[a-f0-9]{64}$/i.test(privateKey)) {
    setStatus("ใส่ PRIVATE_KEY ใน app.js เป็นคีย์บัญชีทดสอบ Sepolia เลขฐานสิบหก 64 ตัว แล้วรีโหลดหน้าเว็บ", "err");
    return;
  }

  $("infuraKey").disabled = true;
  setBusy(true);

  let nextProvider;
  try {
    setStatus("กำลังเชื่อมต่อ Infura...");
    const rpc = new ethers.FetchRequest(INFURA_RPC_BASE + projectId);
    rpc.timeout = 15000;
    nextProvider = new ethers.JsonRpcProvider(rpc, "sepolia", {
      batchMaxCount: 1
    });

    const chainId = await nextProvider.send("eth_chainId", []);
    if (BigInt(chainId) !== SEPOLIA_CHAIN_ID) {
      setStatus("RPC ที่เชื่อมต่อไม่ใช่ Sepolia", "err");
      return;
    }

    if (await nextProvider.getCode(CONTRACT_ADDRESS) === "0x") {
      setStatus("ไม่พบ Smart Contract ที่ address นี้บน Sepolia", "err");
      return;
    }

    const wallet = new ethers.Wallet("0x" + privateKey, nextProvider);
    const nextContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    const balance = await nextContract.checkBlance();

    provider = nextProvider;
    contract = nextContract;
    $("account").textContent = short(wallet.address, 8, 6);
    $("network").textContent = "Sepolia (chainId " + SEPOLIA_CHAIN_ID + ")";
    $("balance").textContent = ethers.formatEther(balance);
    $("btnConnect").textContent = "ตัดการเชื่อมต่อ";
    setStatus("เชื่อมต่อ Infura และ Smart Contract สำเร็จ", "ok");
  } catch {
    setStatus(
      "เชื่อมต่อไม่สำเร็จ กรุณาตรวจ Project ID, Private Key และ Contract Address บน Sepolia",
      "err"
    );
  } finally {
    if (!contract) {
      nextProvider?.destroy();
      $("infuraKey").disabled = false;
    }
    setBusy(false);
  }
}

function needConnect() {
  if (!contract) {
    setStatus("กรุณาเชื่อมต่อ Infura ก่อน", "err");
    return true;
  }
  return false;
}

function getAmount() {
  const value = $("amount").value.trim();
  if (!/^(\d+(\.\d{1,18})?|\.\d{1,18})$/.test(value) || Number(value) <= 0) {
    setStatus("กรอกจำนวน ETH ที่มากกว่า 0 โดยใช้ทศนิยมไม่เกิน 18 ตำแหน่ง", "err");
    return null;
  }
  return { text: value, wei: ethers.parseEther(value) };
}

function setBusy(busy) {
  for (const id of ["btnConnect", "btnDeposit", "btnWithdraw", "btnCheck"]) {
    $(id).disabled = busy;
  }
}

async function deposit() {
  if (needConnect()) return;
  const amount = getAmount();
  if (amount === null) return;

  try {
    setBusy(true);
    setStatus("กำลังส่งธุรกรรมฝากผ่าน Infura...");
    const tx = await contract.deposit({ value: amount.wei });
    const link = EXPLORER + "/tx/" + tx.hash;
    setStatus("รอการยืนยันบน blockchain...", "", link);
    await tx.wait();

    setStatus("ฝากเงินสำเร็จ", "ok", link);
    addHistory("Deposit", amount.text, tx.hash);
    $("amount").value = "";
    await checkBalance(true);
  } catch (error) {
    setStatus("ฝากเงินไม่สำเร็จ: " + errMsg(error), "err");
  } finally {
    setBusy(false);
  }
}

async function withdraw() {
  if (needConnect()) return;
  const amount = getAmount();
  if (amount === null) return;

  try {
    setBusy(true);
    setStatus("กำลังส่งธุรกรรมถอนผ่าน Infura...");
    const tx = await contract.withdraw(amount.wei);
    const link = EXPLORER + "/tx/" + tx.hash;
    setStatus("รอการยืนยันบน blockchain...", "", link);
    await tx.wait();

    setStatus("ถอนเงินสำเร็จ", "ok", link);
    addHistory("Withdraw", amount.text, tx.hash);
    $("amount").value = "";
    await checkBalance(true);
  } catch (error) {
    setStatus("ถอนเงินไม่สำเร็จ: " + errMsg(error), "err");
  } finally {
    setBusy(false);
  }
}

async function checkBalance(keepStatus = false) {
  if (needConnect()) return;
  if (!keepStatus) setBusy(true);

  try {
    // ชื่อ checkBlance สะกดตามฟังก์ชันใน Solidity
    const balance = await contract.checkBlance();
    $("balance").textContent = ethers.formatEther(balance);
    if (!keepStatus) setStatus("ตรวจสอบยอดเงินสำเร็จ", "ok");
  } catch (error) {
    setStatus("เช็กยอดไม่สำเร็จ: " + errMsg(error), "err");
  } finally {
    if (!keepStatus) setBusy(false);
  }
}

showContractLink();
$("infuraKey").value = "28ab0630472140e997003aa4114c8dcf";

$("btnConnect").addEventListener("click", connectInfura);
$("btnDeposit").addEventListener("click", deposit);
$("btnWithdraw").addEventListener("click", withdraw);
$("btnCheck").addEventListener("click", () => checkBalance());
