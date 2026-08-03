import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  DollarSign, 
  Activity, 
  TrendingUp, 
  Sparkles, 
  MapPin, 
  Laptop, 
  Clock, 
  User, 
  PlusCircle, 
  RefreshCw, 
  HelpCircle,
  AlertTriangle,
  Info,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total_transactions: 0,
    flagged_transactions: 0,
    amount_saved: 0,
    model_accuracy: 95.8
  });
  const [selectedTx, setSelectedTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Simulator Form State
  const [formData, setFormData] = useState({
    amount: 85.00,
    hour: 12,
    location: 'New York, USA',
    device_type: 'Mobile',
    is_new_device: 0,
    velocity_1h: 1,
    cardholder_age: 35
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`${API_BASE_URL}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch transactions
      const txRes = await fetch(`${API_BASE_URL}/transactions?limit=50`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
        if (txData.length > 0 && !selectedTx) {
          setSelectedTx(txData[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const triggerPreload = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_URL}/preload`, { method: 'POST' });
      await fetchDashboardData();
    } catch (err) {
      console.error("Error preloading database:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setAlertMsg(null);
    try {
      const response = await fetch(`${API_BASE_URL}/predict-fraud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          hour: parseInt(formData.hour),
          location: formData.location,
          device_type: formData.device_type,
          is_new_device: parseInt(formData.is_new_device),
          velocity_1h: parseInt(formData.velocity_1h),
          cardholder_age: parseInt(formData.cardholder_age)
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Insert new transaction at the beginning
        setTransactions(prev => [result, ...prev]);
        setSelectedTx(result);
        
        // Refresh Stats
        const statsRes = await fetch(`${API_BASE_URL}/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Show Alert
        setAlertMsg({
          type: result.label === 'High Risk' ? 'danger' : result.label === 'Review' ? 'warning' : 'success',
          text: `Transaction Processed: Labeled as ${result.label} (Score: ${result.risk_score})`
        });
        
        // Auto-dismiss alert
        setTimeout(() => setAlertMsg(null), 5000);
      } else {
        alert("Failed to process transaction simulator request.");
      }
    } catch (err) {
      console.error("Error simulating transaction:", err);
    } finally {
      setSimulating(false);
    }
  };

  const loadPreset = (type) => {
    let preset = {};
    if (type === 'safe') {
      preset = {
        amount: 24.50,
        hour: 14,
        location: 'Boston, USA',
        device_type: 'Desktop',
        is_new_device: 0,
        velocity_1h: 1,
        cardholder_age: 47
      };
    } else if (type === 'fraud') {
      preset = {
        amount: 980.00,
        hour: 3,
        location: 'Unknown VPN, Ukraine',
        device_type: 'Mobile',
        is_new_device: 1,
        velocity_1h: 6,
        cardholder_age: 26
      };
    } else if (type === 'review') {
      preset = {
        amount: 195.00,
        hour: 23,
        location: 'Lagos, Nigeria',
        device_type: 'Tablet',
        is_new_device: 1,
        velocity_1h: 2,
        cardholder_age: 32
      };
    }
    setFormData(preset);
  };

  // Prepare chart data: count of fraud vs safe by hour of the day
  const getChartData = () => {
    if (transactions.length === 0) return [];
    
    // Group by hour
    const hourlyData = {};
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { hour: `${h}:00`, safe: 0, review: 0, fraud: 0 };
    }

    transactions.forEach(tx => {
      const h = tx.hour;
      if (hourlyData[h]) {
        if (tx.label === 'Safe') hourlyData[h].safe += 1;
        else if (tx.label === 'Review') hourlyData[h].review += 1;
        else if (tx.label === 'High Risk') hourlyData[h].fraud += 1;
      }
    });

    // Return sorted hours
    return Object.values(hourlyData);
  };

  const chartData = getChartData();

  return (
    <div className="min-h-screen bg-brand-lightBg flex flex-col font-sans">
      
      {/* Top Banner Navigation */}
      <header className="bg-brand-navy text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-accentGreen p-2 rounded-lg flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-brand-navy" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SentinelPay <span className="text-brand-accentGreen">AI</span></h1>
              <p className="text-xs text-slate-400">Enterprise Fraud Detection Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-brand-accentGreen animate-pulse"></span>
              <span>Model Status: Active</span>
            </div>
            
            <button 
              onClick={fetchDashboardData}
              className="flex items-center space-x-1.5 bg-brand-mediumBlue hover:bg-slate-700 text-white text-sm px-3.5 py-2 rounded-lg transition-colors font-medium border border-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Alerts Center */}
        {alertMsg && (
          <div className={`p-4 rounded-xl border flex items-start space-x-3 shadow-sm animate-pulse-soft transition-all duration-300 ${
            alertMsg.type === 'danger' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : alertMsg.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {alertMsg.type === 'danger' ? (
              <ShieldAlert className="h-5 w-5 mt-0.5 text-rose-600 flex-shrink-0" />
            ) : alertMsg.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0" />
            ) : (
              <ShieldCheck className="h-5 w-5 mt-0.5 text-emerald-600 flex-shrink-0" />
            )}
            <div className="text-sm font-semibold">{alertMsg.text}</div>
          </div>
        )}

        {/* Empty Database Initial Action */}
        {!loading && transactions.length === 0 && (
          <div className="bg-white border border-brand-borderGray p-8 rounded-2xl shadow-sm text-center max-w-lg mx-auto my-12 space-y-4">
            <Activity className="h-12 w-12 text-slate-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">No Transactions Logged</h3>
            <p className="text-sm text-slate-500">
              The SQLite database is initialized but empty. Preload it with 25 synthetic transactions to visualize the trends instantly.
            </p>
            <button
              onClick={triggerPreload}
              className="bg-brand-mediumBlue hover:bg-brand-navy text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-all"
            >
              Preload Simulation Data
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Total Transactions */}
          <div className="bg-white border border-brand-borderGray rounded-2xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">Total Processed</span>
              <p className="text-3xl font-extrabold text-brand-navy">{stats.total_transactions}</p>
              <span className="text-xs text-slate-400">Digital transactions</span>
            </div>
            <div className="bg-slate-100 p-3.5 rounded-2xl">
              <Activity className="h-6 w-6 text-brand-navy" />
            </div>
          </div>

          {/* Card 2: Flagged Transactions */}
          <div className="bg-white border border-brand-borderGray rounded-2xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">Flagged Suspects</span>
              <p className="text-3xl font-extrabold text-amber-600">{stats.flagged_transactions}</p>
              <span className="text-xs text-slate-400">
                {stats.total_transactions > 0 
                  ? `${((stats.flagged_transactions / stats.total_transactions) * 100).toFixed(1)}% detection rate`
                  : '0% detection rate'}
              </span>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-2xl">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </div>

          {/* Card 3: Estimated Amount Saved */}
          <div className="bg-white border border-brand-borderGray rounded-2xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">Estimated Saved</span>
              <p className="text-3xl font-extrabold text-brand-accentGreen">
                ${stats.amount_saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-400">Blocked High Risk values</span>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-2xl">
              <DollarSign className="h-6 w-6 text-brand-accentGreen" />
            </div>
          </div>

          {/* Card 4: Model Accuracy */}
          <div className="bg-white border border-brand-borderGray rounded-2xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">Model Accuracy</span>
              <p className="text-3xl font-extrabold text-indigo-600">{stats.model_accuracy}%</p>
              <span className="text-xs text-slate-400">Random Forest accuracy</span>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-2xl">
              <Sparkles className="h-6 w-6 text-indigo-600" />
            </div>
          </div>

        </div>

        {/* Dashboard Grid (Charts & Simulator) */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Trend Chart (Left 2 Columns) */}
            <div className="bg-white border border-brand-borderGray rounded-2xl p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    <span>Hourly Fraud Trend Analysis</span>
                  </h3>
                  <p className="text-xs text-slate-400">Visualizing risk clusters and volumes based on transaction hours</p>
                </div>
              </div>
              
              <div className="h-64 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorReview" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="hour" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px' }} 
                      labelStyle={{ fontWeight: 'bold', color: '#0B192C' }}
                    />
                    <Area type="monotone" dataKey="fraud" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFraud)" name="High Risk" />
                    <Area type="monotone" dataKey="review" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorReview)" name="Review" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaction Simulator (Right 1 Column) */}
            <div className="bg-white border border-brand-borderGray rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-1 mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <PlusCircle className="h-5 w-5 text-brand-accentGreen" />
                  <span>Transaction Simulator</span>
                </h3>
                <p className="text-xs text-slate-400">Trigger transactions manually or load test presets</p>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button 
                  type="button" 
                  onClick={() => loadPreset('safe')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold py-2 rounded-xl transition-all border border-emerald-100"
                >
                  Safe Preset
                </button>
                <button 
                  type="button" 
                  onClick={() => loadPreset('review')}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold py-2 rounded-xl transition-all border border-amber-100"
                >
                  Review Preset
                </button>
                <button 
                  type="button" 
                  onClick={() => loadPreset('fraud')}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 rounded-xl transition-all border border-rose-100"
                >
                  Fraud Preset
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSimulateSubmit} className="space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Amount ($)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required
                      value={formData.amount}
                      onChange={e => setFormData(prev => ({...prev, amount: e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Time (Hour 0-23)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="23"
                      required
                      value={formData.hour}
                      onChange={e => setFormData(prev => ({...prev, hour: e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Location</label>
                    <input 
                      type="text" 
                      required
                      value={formData.location}
                      onChange={e => setFormData(prev => ({...prev, location: e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Device Type</label>
                    <select
                      value={formData.device_type}
                      onChange={e => setFormData(prev => ({...prev, device_type: e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    >
                      <option value="Mobile">Mobile</option>
                      <option value="Desktop">Desktop</option>
                      <option value="Tablet">Tablet</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Device Trust</label>
                    <select
                      value={formData.is_new_device}
                      onChange={e => setFormData(prev => ({...prev, is_new_device: parseInt(e.target.value)}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    >
                      <option value="0">Trusted Device</option>
                      <option value="1">New/Unrecognized Device</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Tx Velocity (1h)</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={formData.velocity_1h}
                      onChange={e => setFormData(prev => ({...prev, velocity_1h: e.target.value}))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-semibold text-slate-600">Cardholder Age</label>
                  <input 
                    type="number" 
                    min="18" 
                    max="100"
                    required
                    value={formData.cardholder_age}
                    onChange={e => setFormData(prev => ({...prev, cardholder_age: e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-mediumBlue text-slate-800 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={simulating}
                  className="w-full bg-brand-navy hover:bg-slate-850 text-white text-sm font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 mt-2"
                >
                  <RefreshCw className={`h-4 w-4 ${simulating ? 'animate-spin' : ''}`} />
                  <span>{simulating ? 'Evaluating...' : 'Simulate Transaction'}</span>
                </button>
              </form>
            </div>

          </div>
        )}

        {/* Bottom Section: Logs and Auditor Panel */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Table Feed (Left 2 Columns) */}
            <div className="bg-white border border-brand-borderGray rounded-2xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col justify-between">
              
              <div className="p-6 border-b border-brand-borderGray">
                <h3 className="text-lg font-bold text-slate-800">Real-Time Transaction Activity Logs</h3>
                <p className="text-xs text-slate-400">Select any row to audit the ML model explanation factors</p>
              </div>

              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Device</th>
                      <th className="px-6 py-4">Risk score</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isSelected = selectedTx && selectedTx.id === tx.id;
                      const dateObj = new Date(tx.timestamp);
                      const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const labelColor = 
                        tx.label === 'High Risk' 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : tx.label === 'Review'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            
                      return (
                        <tr 
                          key={tx.id} 
                          onClick={() => setSelectedTx(tx)}
                          className={`border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-xs font-medium text-slate-700 ${isSelected ? 'bg-slate-50 border-l-4 border-l-brand-mediumBlue pl-5' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{formattedTime}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">${tx.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span className="truncate max-w-[120px]">{tx.location}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center space-x-1">
                              <Laptop className="h-3 w-3 text-slate-400" />
                              <span>{tx.device_type} {tx.is_new_device === 1 && '(New)'}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold">{tx.risk_score}%</span>
                              <div className="w-12 bg-slate-100 rounded-full h-1.5 hidden sm:block">
                                <div 
                                  className={`h-1.5 rounded-full ${tx.risk_score >= 75 ? 'bg-rose-500' : tx.risk_score >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${tx.risk_score}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${labelColor}`}>
                              {tx.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400 font-semibold">
                Displaying latest {transactions.length} transactions log records
              </div>
            </div>

            {/* Explainability Auditor Drawer (Right 1 Column) */}
            <div className="bg-white border border-brand-borderGray rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              {selectedTx ? (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  {/* Title Header */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                      <Info className="h-5 w-5 text-indigo-500" />
                      <span>Model Audit Assessment</span>
                    </h3>
                    <p className="text-xs text-slate-400">Audit trail breakdown for Transaction #{selectedTx.id}</p>
                  </div>

                  {/* Large Risk Badge */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-2 relative overflow-hidden">
                    {/* Background indicator */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                      selectedTx.label === 'High Risk' ? 'bg-rose-500' : selectedTx.label === 'Review' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></div>
                    
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Overall Risk Assessment</span>
                    <p className="text-5xl font-black text-slate-900">{selectedTx.risk_score}%</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedTx.label === 'High Risk' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : selectedTx.label === 'Review'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedTx.label}
                    </span>
                  </div>

                  {/* Factor Contribution Bars */}
                  <div className="space-y-4 flex-1 mt-4">
                    <h4 className="text-xs text-slate-500 font-bold uppercase tracking-wider">Key Contributor Factors</h4>
                    
                    <div className="space-y-3.5">
                      {selectedTx.explanations && selectedTx.explanations.map((exp, idx) => {
                        const statusColor = 
                          exp.status === 'Critical' 
                            ? 'text-rose-600 bg-rose-50 border-rose-100' 
                            : exp.status === 'Warning'
                              ? 'text-amber-600 bg-amber-50 border-amber-100'
                              : 'text-slate-500 bg-slate-50 border-slate-100';

                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span className="text-slate-700">{exp.name}</span>
                              <span className="text-slate-500">{exp.value}</span>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              {/* Contribution bar */}
                              <div className="flex-1 bg-slate-100 rounded-full h-2 relative">
                                <div 
                                  className={`h-2 rounded-full ${
                                    exp.status === 'Critical' ? 'bg-rose-500' : exp.status === 'Warning' ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${exp.percentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold w-12 text-center truncate ${statusColor}`}>
                                {exp.percentage}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Diagnostic Summary */}
                  <div className="text-xs bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 mt-4 text-indigo-900 font-medium">
                    <h5 className="font-bold flex items-center space-x-1.5 mb-1 text-indigo-950">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Auditor Diagnostic Summary</span>
                    </h5>
                    {selectedTx.label === 'High Risk' ? (
                      <p>
                        This transaction is flagged as <strong>High Risk</strong> due to a combined profile anomaly, chiefly driven by a new device, a high location risk index, and high velocity metrics. Immediate decline/blocking recommended.
                      </p>
                    ) : selectedTx.label === 'Review' ? (
                      <p>
                        This transaction requires manual oversight. The transaction details present mild deviation from standard customer spending habits, but does not trigger the absolute threat threshold.
                      </p>
                    ) : (
                      <p>
                        The cardholder activity is consistent with historical patterns. Features exhibit normal distributions, indicating low risk, safe transaction.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Info className="h-8 w-8 mx-auto" />
                  <p className="text-sm font-semibold">No Transaction Selected</p>
                  <p className="text-xs">Click a transaction log row to view ML analysis details</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 font-semibold space-y-1">
          <p>© {new Date().getFullYear()} SentinelPay AI Inc. All rights reserved.</p>
          <p>Powered by Random Forest classification served via FastAPI REST APIs.</p>
        </div>
      </footer>

    </div>
  );
}

export default App;
