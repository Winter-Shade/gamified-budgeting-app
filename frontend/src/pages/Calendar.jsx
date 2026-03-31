import React, { useEffect, useState } from 'react';
import { getCalendarData } from '../api/api';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarPage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => { fetchCalendar(); }, [year, month]);

  const fetchCalendar = async () => {
    setIsLoading(true);
    try { setData(await getCalendarData(`${year}-${String(month).padStart(2, '0')}`)); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = {};
  if (data?.days) data.days.forEach(d => { dayMap[new Date(d.date).getDate()] = d; });
  const maxSpend = data?.days?.length > 0 ? Math.max(...data.days.map(d => d.amount)) : 1;
  const getInt = (a) => { if (!a) return 0; const r = a / maxSpend; return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : 4; };
  const intColors = ['transparent', 'rgba(157,133,255,0.08)', 'rgba(157,133,255,0.18)', 'rgba(157,133,255,0.35)', 'rgba(157,133,255,0.6)'];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} style={styles.dayCell} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = dayMap[d];
    const int = getInt(dd?.amount || 0);
    const isToday = d === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
    cells.push(
      <div key={d} style={{ ...styles.dayCell, backgroundColor: intColors[int], boxShadow: isToday ? '0 0 0 2px var(--primary)' : 'none' }}
        title={dd ? `₹${dd.amount.toFixed(2)} (${dd.count} txns)` : 'No spending'}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{d}</span>
        {dd && <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--primary)' }}>₹{dd.amount >= 1000 ? `${(dd.amount/1000).toFixed(1)}k` : dd.amount.toFixed(0)}</span>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      <div className="flex-col gap-8">
        <div>
          <div className="flex-row items-center gap-3">
            <CalendarDays size={22} color="var(--primary)" strokeWidth={1.5} />
            <h1 className="text-xl">Calendar</h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Spending intensity by day</p>
        </div>

        <div className="glass-card card-2xl">
          <div className="flex-row items-center justify-between" style={{ marginBottom: '24px' }}>
            <button onClick={prevMonth} style={styles.navBtn}><ChevronLeft size={18} /></button>
            <h2 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{monthName}</h2>
            <button onClick={nextMonth} style={styles.navBtn}><ChevronRight size={18} /></button>
          </div>

          <div style={styles.grid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 0' }}>{d}</div>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>Loading...</div>
          ) : (
            <div style={styles.grid}>{cells}</div>
          )}

          <div className="flex-row items-center justify-center gap-3" style={{ marginTop: '20px' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>Less</span>
            {intColors.map((c, i) => <div key={i} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: c, border: i === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }} />)}
            <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' },
  dayCell: { aspectRatio: '1', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', minHeight: '56px', transition: 'all 0.15s' },
  navBtn: { background: 'var(--surface-container-highest)', border: 'none', color: 'var(--on-surface)', borderRadius: '12px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },
};

export default CalendarPage;
