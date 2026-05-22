import { useEffect, useState } from 'react';
import { Timer, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DonutChart from '../components/DonutChart';
import { getTeamHours, getWeeklyHours } from '../services/redmineApi';

export default function Hours() {
  const [my, setMy] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [w, t] = await Promise.all([getWeeklyHours(), getTeamHours()]);
      setMy(w);
      setTeam(t);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="text-sm text-ink-muted">
          Weekly logged time — drill into your own entries or the team breakdown.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/hours/me')}
          className="card p-6 text-left hover:shadow-md transition flex items-center gap-6"
        >
          <DonutChart
            value={my.logged}
            total={my.target}
            color="#10B981"
            label={`${my.logged}/${my.target}`}
          />
          <div>
            <div className="flex items-center gap-2 text-ink-muted text-xs uppercase tracking-wide">
              <Timer size={14} /> Personal
            </div>
            <h2 className="text-lg font-semibold mt-1">My hours this week</h2>
            <p className="text-sm text-ink-muted">
              Log time, edit entries, and review what you've shipped.
            </p>
          </div>
        </button>
        <button
          onClick={() => navigate('/hours/team')}
          className="card p-6 text-left hover:shadow-md transition flex items-center gap-6"
        >
          <DonutChart
            value={team.logged}
            total={team.target}
            color="#F59E0B"
            label={`${team.logged}/${team.target}`}
          />
          <div>
            <div className="flex items-center gap-2 text-ink-muted text-xs uppercase tracking-wide">
              <Users size={14} /> Team
            </div>
            <h2 className="text-lg font-semibold mt-1">Team hours this week</h2>
            <p className="text-sm text-ink-muted">
              Per-engineer breakdown with percent of total and drill-in tasks.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
