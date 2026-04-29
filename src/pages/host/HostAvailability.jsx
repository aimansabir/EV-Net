import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { availabilityService, listingService } from '../../data/api';
import { ChevronDown } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const HostAvailability = () => {
  const { user } = useAuthStore();
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState('');
  const [schedule, setSchedule] = useState({});
  const [saved, setSaved] = useState(false);

  const format12h = (time24) => {
    const [h, m] = time24.split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${hour}:${m} ${ampm}`;
  };

  useEffect(() => {
    const load = async () => {
      const ls = await listingService.getByHost(user?.id || 'host_ahsan');
      setListings(ls);
      if (ls.length > 0) setSelectedListing(ls[0].id);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedListing) return;
    const load = async () => {
      const avail = await availabilityService.getByListing(selectedListing);
      const sched = {};
      avail.forEach(a => {
        sched[a.dayOfWeek] = { enabled: true, start: a.startTime, end: a.endTime };
      });
      setSchedule(sched);
      setSaved(false);
    };
    load();
  }, [selectedListing]);

  const toggleDay = (day) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day]?.enabled ? { ...prev[day], enabled: false } : { enabled: true, start: '09:00', end: '18:00' },
    }));
    setSaved(false);
  };

  const updateTime = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    const schedules = Object.entries(schedule)
      .filter(([, v]) => v.enabled)
      .map(([day, v]) => ({ dayOfWeek: parseInt(day), startTime: v.start, endTime: v.end }));
    await availabilityService.set(selectedListing, schedules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="container" style={{ maxWidth: '700px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.5rem' }}>Availability Schedule</h2>

        {listings.length > 1 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <select className="auth-select" value={selectedListing} onChange={e => setSelectedListing(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem 2.5rem 0.75rem 1rem', 
                  background: 'rgba(11,15,25,0.6)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '10px', 
                  color: 'white', 
                  fontSize: '0.95rem',
                  appearance: 'none',
                  cursor: 'pointer'
                }}>
                {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
        )}

        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {DAYS.map((dayName, dayIdx) => {
              const dayData = schedule[dayIdx];
              const isEnabled = dayData?.enabled;
              return (
                <div key={dayIdx} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem',
                  borderRadius: '8px', background: isEnabled ? 'rgba(0,210,106,0.05)' : 'transparent',
                  border: isEnabled ? '1px solid rgba(0,210,106,0.2)' : '1px solid var(--border-color)',
                  transition: 'all 0.2s',
                }}>
                  <button onClick={() => toggleDay(dayIdx)} style={{
                    width: '40px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: isEnabled ? 'var(--brand-green)' : 'rgba(255,255,255,0.1)',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '3px',
                      left: isEnabled ? '19px' : '3px', transition: 'left 0.2s',
                    }} />
                  </button>
                  <span style={{ width: '90px', fontWeight: 500, color: isEnabled ? '#fff' : 'var(--text-secondary)' }}>{dayName}</span>
                  {isEnabled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <select value={dayData.start} onChange={e => updateTime(dayIdx, 'start', e.target.value)}
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(11,15,25,0.6)', color: '#fff', fontSize: '0.85rem' }}>
                        {HOURS.map(h => <option key={h} value={h}>{format12h(h)}</option>)}
                      </select>
                      <span style={{ color: 'var(--text-secondary)' }}>to</span>
                      <select value={dayData.end} onChange={e => updateTime(dayIdx, 'end', e.target.value)}
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(11,15,25,0.6)', color: '#fff', fontSize: '0.85rem' }}>
                        {HOURS.map(h => <option key={h} value={h}>{format12h(h)}</option>)}
                      </select>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginTop: '1.5rem' }}>
            {saved ? '✓ Saved!' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HostAvailability;
