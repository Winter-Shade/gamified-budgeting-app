import React, { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import {
  getBlockchainPlans, createBlockchainPlan, getBlockchainDeposits,
  recordBlockchainDeposit, updateBlockchainStatus, updateBlockchainOnchain,
  getContractInfo,
} from '../api/api';
import {
  Shield, Wallet, Plus, ArrowDownToLine, ArrowUpFromLine,
  Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

const TERMS = [
  "Your deposited ETH will be locked in a smart contract on the Sepolia testnet until the maturity date you choose.",
  "Early withdrawal before maturity will incur a penalty (percentage chosen at plan creation). The penalty is sent to the contract fee collector and is non-refundable.",
  "The maturity period and penalty rate are immutable once the plan is created on-chain.",
  "This is a beta feature running on the Sepolia testnet. Only use test ETH, not real funds.",
  "You are responsible for keeping your MetaMask wallet and private keys secure. Lost keys cannot be recovered.",
  "By proceeding, you acknowledge that you understand the risks of interacting with smart contracts and accept full responsibility.",
];

const cardStyle = {
  background: 'var(--surface-container)',
  border: '1px solid var(--outline)',
  borderRadius: 16,
  padding: '1.25rem',
};

const btnPrimary = {
  padding: '0.625rem 1.25rem',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #4f3bdb, #9D85FF)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
};

const btnOutline = {
  padding: '0.625rem 1.25rem',
  borderRadius: 10,
  border: '1px solid var(--outline)',
  background: 'transparent',
  color: 'var(--on-surface)',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--outline)',
  background: 'var(--surface-container-high)',
  color: 'var(--on-surface)',
  fontSize: '0.8125rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--on-surface-variant)',
  marginBottom: 4,
  display: 'block',
};

export default function BlockchainSavings() {
  const [plans, setPlans] = useState([]);
  const [contractInfo, setContractInfo] = useState({ address: null, abi: null });
  const [walletAddress, setWalletAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create plan form
  const [showCreate, setShowCreate] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    depositAmount: '0.01',
    intervalDays: '1',
    maturityDays: '30',
    penaltyBps: '1000',
  });
  const [creating, setCreating] = useState(false);

  // Deposit form
  const [depositPlanId, setDepositPlanId] = useState(null);
  const [depositAmount, setDepositAmount] = useState('0.01');
  const [depositing, setDepositing] = useState(false);

  // Expanded plan
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [planDeposits, setPlanDeposits] = useState({});

  // Withdraw
  const [withdrawing, setWithdrawing] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [plansData, info] = await Promise.all([getBlockchainPlans(), getContractInfo()]);
      setPlans(plansData);
      setContractInfo(info);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const connectWallet = async () => {
    clearMessages();
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use this feature.');
      return;
    }
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
      setProvider(browserProvider);

      // Check network — Sepolia chainId is 11155111
      const network = await browserProvider.getNetwork();
      if (network.chainId !== 11155111n) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch {
          setError('Please switch to Sepolia testnet in MetaMask.');
        }
      }
    } catch (e) {
      setError('Failed to connect wallet: ' + e.message);
    }
  };

  const getContract = async () => {
    if (!contractInfo.address || !contractInfo.abi || !provider) return null;
    const signer = await provider.getSigner();
    return new Contract(contractInfo.address, contractInfo.abi, signer);
  };

  const handleCreatePlan = async () => {
    clearMessages();
    if (!termsAccepted) { setError('You must accept the terms and conditions.'); return; }
    if (!walletAddress) { setError('Connect your wallet first.'); return; }

    setCreating(true);
    try {
      const contract = await getContract();
      const depositWei = parseEther(form.depositAmount);

      if (contract) {
        // Create on-chain
        const tx = await contract.createPlan(
          depositWei,
          parseInt(form.intervalDays),
          parseInt(form.maturityDays),
          parseInt(form.penaltyBps),
        );
        const receipt = await tx.wait();

        // Get planId from event
        const event = receipt.logs.find(
          log => { try { return contract.interface.parseLog(log)?.name === 'PlanCreated'; } catch { return false; } }
        );
        const planIdOnchain = event ? contract.interface.parseLog(event).args[0] : null;

        // Save to backend
        const plan = await createBlockchainPlan({
          wallet_address: walletAddress,
          contract_address: contractInfo.address,
          plan_id_onchain: planIdOnchain !== null ? Number(planIdOnchain) : null,
          deposit_amount_wei: depositWei.toString(),
          interval_days: parseInt(form.intervalDays),
          maturity_days: parseInt(form.maturityDays),
          penalty_bps: parseInt(form.penaltyBps),
        });
        setSuccess('Plan created on-chain! Tx: ' + receipt.hash);
      } else {
        // No contract deployed — just save to backend (demo mode)
        await createBlockchainPlan({
          wallet_address: walletAddress,
          deposit_amount_wei: depositWei.toString(),
          interval_days: parseInt(form.intervalDays),
          maturity_days: parseInt(form.maturityDays),
          penalty_bps: parseInt(form.penaltyBps),
        });
        setSuccess('Plan created (demo mode — no contract deployed yet).');
      }

      setShowCreate(false);
      setTermsAccepted(false);
      fetchData();
    } catch (e) {
      setError('Failed to create plan: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeposit = async (plan) => {
    clearMessages();
    if (!walletAddress) { setError('Connect your wallet first.'); return; }
    setDepositing(true);

    try {
      const contract = await getContract();
      if (contract && plan.plan_id_onchain !== null) {
        const tx = await contract.deposit(plan.plan_id_onchain, {
          value: parseEther(depositAmount),
        });
        const receipt = await tx.wait();

        await recordBlockchainDeposit(plan.id, {
          tx_hash: receipt.hash,
          amount_wei: parseEther(depositAmount).toString(),
        });
        setSuccess('Deposit successful! Tx: ' + receipt.hash);
      } else {
        setError('No on-chain plan found. Deploy the contract first.');
      }

      setDepositPlanId(null);
      fetchData();
    } catch (e) {
      setError('Deposit failed: ' + e.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async (plan) => {
    clearMessages();
    if (!walletAddress) { setError('Connect your wallet first.'); return; }
    setWithdrawing(plan.id);

    try {
      const contract = await getContract();
      if (contract && plan.plan_id_onchain !== null) {
        const tx = await contract.withdraw(plan.plan_id_onchain);
        const receipt = await tx.wait();
        await updateBlockchainStatus(plan.id, 'withdrawn');
        setSuccess(
          plan.is_matured
            ? 'Full withdrawal successful! Tx: ' + receipt.hash
            : 'Early withdrawal with penalty applied. Tx: ' + receipt.hash
        );
      } else {
        setError('No on-chain plan found.');
      }
      fetchData();
    } catch (e) {
      setError('Withdrawal failed: ' + e.message);
    } finally {
      setWithdrawing(null);
    }
  };

  const toggleExpand = async (planId) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      return;
    }
    setExpandedPlan(planId);
    if (!planDeposits[planId]) {
      try {
        const deps = await getBlockchainDeposits(planId);
        setPlanDeposits(prev => ({ ...prev, [planId]: deps }));
      } catch {}
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: 4 }}>
          Blockchain Savings
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
          Lock your savings in a smart contract. Stay committed, avoid temptation.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ ...cardStyle, background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} color="#ff3b30" />
          <span style={{ fontSize: '0.8125rem', color: '#ff6b6b' }}>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1rem' }}>x</button>
        </div>
      )}
      {success && (
        <div style={{ ...cardStyle, background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.3)', marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle2 size={16} color="var(--tertiary)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--tertiary)', wordBreak: 'break-all' }}>{success}</span>
          <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--tertiary)', cursor: 'pointer', fontSize: '1rem' }}>x</button>
        </div>
      )}

      {/* Wallet connection */}
      <div style={{ ...cardStyle, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wallet size={18} color="var(--primary)" />
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface)' }}>
              {walletAddress ? 'Wallet Connected' : 'Connect MetaMask'}
            </p>
            {walletAddress && (
              <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            )}
          </div>
        </div>
        {!walletAddress ? (
          <button onClick={connectWallet} style={btnPrimary}>Connect Wallet</button>
        ) : (
          <span style={{
            fontSize: '0.6875rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(16,217,160,0.15)', color: 'var(--tertiary)', border: '1px solid rgba(16,217,160,0.25)',
          }}>Sepolia</span>
        )}
      </div>

      {/* Contract status */}
      <div style={{ ...cardStyle, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Shield size={18} color={contractInfo.address ? 'var(--tertiary)' : 'var(--on-surface-variant)'} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface)' }}>Smart Contract</p>
          {contractInfo.address ? (
            <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
              {contractInfo.address}
            </p>
          ) : (
            <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>
              Not deployed yet. Deploy via Hardhat to enable on-chain features.
            </p>
          )}
        </div>
      </div>

      {/* Create plan button */}
      {!showCreate && (
        <button onClick={() => { clearMessages(); setShowCreate(true); }} style={{ ...btnPrimary, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> New Savings Plan
        </button>
      )}

      {/* Create plan form */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '1rem' }}>
            Create Commitment Plan
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Deposit Amount (ETH)</label>
              <input type="number" step="0.001" min="0.001" value={form.depositAmount}
                onChange={e => setForm({ ...form, depositAmount: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Interval</label>
              <select value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: e.target.value })}
                style={inputStyle}>
                <option value="1">Daily</option>
                <option value="7">Weekly</option>
                <option value="14">Bi-weekly</option>
                <option value="30">Monthly</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Maturity Period (days)</label>
              <input type="number" min="1" value={form.maturityDays}
                onChange={e => setForm({ ...form, maturityDays: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Early Withdrawal Penalty</label>
              <select value={form.penaltyBps} onChange={e => setForm({ ...form, penaltyBps: e.target.value })}
                style={inputStyle}>
                <option value="500">5%</option>
                <option value="1000">10%</option>
                <option value="1500">15%</option>
                <option value="2000">20%</option>
                <option value="2500">25%</option>
                <option value="3000">30%</option>
                <option value="5000">50%</option>
              </select>
            </div>
          </div>

          {/* Terms */}
          <div style={{
            background: 'var(--surface-container-high)',
            border: '1px solid var(--outline)',
            borderRadius: 12,
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.75rem' }}>
              Terms & Conditions
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {TERMS.map((t, i) => (
                <li key={i} style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: 6, lineHeight: 1.5 }}>
                  {t}
                </li>
              ))}
            </ol>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                I accept the terms and conditions
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreatePlan} disabled={creating || !termsAccepted}
              style={{ ...btnPrimary, opacity: (creating || !termsAccepted) ? 0.5 : 1 }}>
              {creating ? 'Creating...' : 'Create Plan'}
            </button>
            <button onClick={() => { setShowCreate(false); setTermsAccepted(false); }} style={btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Plans list */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.75rem' }}>
        Your Plans
      </h2>

      {plans.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}>
          <Shield size={32} color="var(--on-surface-variant)" style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
            No savings plans yet. Create one to get started!
          </p>
        </div>
      ) : (
        plans.map(plan => (
          <div key={plan.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
            {/* Plan header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => toggleExpand(plan.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: plan.status === 'withdrawn' ? 'rgba(255,59,48,0.15)' :
                    plan.is_matured ? 'rgba(16,217,160,0.15)' : 'rgba(157,133,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {plan.status === 'withdrawn' ? <CheckCircle2 size={18} color="#ff6b6b" /> :
                    plan.is_matured ? <CheckCircle2 size={18} color="var(--tertiary)" /> :
                    <Clock size={18} color="var(--primary)" />}
                </div>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface)' }}>
                    {formatEther(plan.deposit_amount_wei)} ETH / {plan.interval_days === 1 ? 'day' : plan.interval_days === 7 ? 'week' : `${plan.interval_days} days`}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>
                    {plan.maturity_days} day maturity | {plan.penalty_bps / 100}% penalty | {plan.total_deposits} deposits
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  background: plan.status === 'withdrawn' ? 'rgba(255,59,48,0.15)' :
                    plan.is_matured ? 'rgba(16,217,160,0.15)' : 'rgba(157,133,255,0.15)',
                  color: plan.status === 'withdrawn' ? '#ff6b6b' :
                    plan.is_matured ? 'var(--tertiary)' : 'var(--primary)',
                }}>
                  {plan.status === 'withdrawn' ? 'Withdrawn' : plan.is_matured ? 'Matured' : 'Active'}
                </span>
                {expandedPlan === plan.id ? <ChevronUp size={16} color="var(--on-surface-variant)" /> :
                  <ChevronDown size={16} color="var(--on-surface-variant)" />}
              </div>
            </div>

            {/* Expanded details */}
            {expandedPlan === plan.id && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--outline)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>Wallet</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'monospace' }}>
                      {plan.wallet_address.slice(0, 6)}...{plan.wallet_address.slice(-4)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>Created</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)' }}>Contract</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface)', fontFamily: 'monospace' }}>
                      {plan.contract_address ? `${plan.contract_address.slice(0, 6)}...${plan.contract_address.slice(-4)}` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Actions for active plans */}
                {plan.status !== 'withdrawn' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {/* Deposit */}
                    {depositPlanId === plan.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" step="0.001" min="0.001" value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                          style={{ ...inputStyle, width: 120 }} />
                        <button onClick={() => handleDeposit(plan)} disabled={depositing}
                          style={{ ...btnPrimary, fontSize: '0.75rem', padding: '0.4rem 0.75rem', opacity: depositing ? 0.5 : 1 }}>
                          {depositing ? 'Sending...' : 'Confirm'}
                        </button>
                        <button onClick={() => setDepositPlanId(null)} style={{ ...btnOutline, fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setDepositPlanId(plan.id); setDepositAmount(formatEther(plan.deposit_amount_wei)); }}
                        style={{ ...btnPrimary, fontSize: '0.75rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowDownToLine size={13} /> Deposit
                      </button>
                    )}

                    {/* Withdraw */}
                    <button onClick={() => {
                      if (window.confirm(
                        plan.is_matured
                          ? 'Withdraw all funds? No penalty applies since the plan has matured.'
                          : `Early withdrawal! A ${plan.penalty_bps / 100}% penalty will be deducted. Proceed?`
                      )) handleWithdraw(plan);
                    }}
                      disabled={withdrawing === plan.id}
                      style={{
                        ...btnOutline, fontSize: '0.75rem', padding: '0.4rem 0.75rem',
                        display: 'flex', alignItems: 'center', gap: 4,
                        borderColor: plan.is_matured ? 'rgba(16,217,160,0.4)' : 'rgba(255,59,48,0.4)',
                        color: plan.is_matured ? 'var(--tertiary)' : '#ff6b6b',
                        opacity: withdrawing === plan.id ? 0.5 : 1,
                      }}>
                      <ArrowUpFromLine size={13} />
                      {withdrawing === plan.id ? 'Processing...' : plan.is_matured ? 'Withdraw (No Penalty)' : 'Early Withdraw'}
                    </button>
                  </div>
                )}

                {/* Deposit history */}
                {planDeposits[plan.id] && planDeposits[plan.id].length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: 6 }}>
                      Deposit History
                    </p>
                    {planDeposits[plan.id].map(dep => (
                      <div key={dep.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.375rem 0', borderBottom: '1px solid var(--outline)',
                      }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                            {formatEther(dep.amount_wei)} ETH
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--on-surface-variant)', marginLeft: 8 }}>
                            {new Date(dep.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <a href={`https://sepolia.etherscan.io/tx/${dep.tx_hash}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', color: 'var(--primary)', textDecoration: 'none' }}>
                          {dep.tx_hash.slice(0, 8)}... <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
