import { Link } from 'react-router';
import { ArrowRight, Bot, Terminal, Trophy } from 'lucide-react';
import { useMe } from '../lib/auth';
import { QuantumVisual } from '../components/QuantumVisual';
import { btnPrimary, btnSecondary } from '../components/ui';

const transcript: { cmd: string; out: string }[] = [
  { cmd: 'look', out: 'Briefing Room. A windowless room deep inside the mountain. A heavy door leads north. You see: tablet, mug.' },
  { cmd: 'take tablet', out: 'You pick up the tablet. Its screen flickers to life.' },
  { cmd: 'examine tablet', out: 'A ruggedised tablet. The last message reads: "The badge is in the locker. Hurry."' },
  { cmd: 'go north', out: 'Level 28 Corridor. Caged bulbs hum overhead. Exits: south, east, north.' },
];

export function Home() {
  const { me } = useMe();
  return (
    <div className="space-y-16">
      <section className="flex flex-col items-center gap-12 lg:flex-row">
        <div className="space-y-6 lg:w-3/5">
          <p className="font-mono text-sm text-quantum-400">&gt; WELCOME, TRAVELLER</p>
          <h1 className="bg-gradient-to-r from-white via-quantum-100 to-quantum-500 bg-clip-text text-4xl font-black leading-tight text-transparent sm:text-5xl xl:text-6xl">
            Enter The Quantum Quest.
          </h1>
          <p className="border-l-4 border-quantum-500 pl-4 text-lg leading-relaxed text-slate-400">
            A text adventure you play over an <strong className="text-white">HTTP API</strong>. Explore rooms, pick up items, solve puzzles and
            escape each level in as few actions as possible: type commands in the web terminal, or write a script — or an AI agent — that plays
            for you.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link to={me ? '/level-select' : '/login'} className={`${btnPrimary} px-8 py-3 text-base`}>
              Start Quest <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/guides" className={`${btnSecondary} px-8 py-3 text-base`}>
              Read Guides
            </Link>
          </div>
        </div>
        <div className="w-full lg:w-2/5">
          <QuantumVisual />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Terminal, title: 'Play in the browser', text: 'A web terminal for every level, with command history.' },
          { icon: Bot, title: 'Or play by API', text: 'Same game, plain JSON over HTTP. Perfect for scripts and AI agents.' },
          { icon: Trophy, title: 'Compete in events', text: 'Time-boxed events with live leaderboards.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <Icon size={22} className="mb-3 text-quantum-400" aria-hidden />
            <h2 className="font-bold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="rounded-lg bg-slate-800 p-3 text-quantum-400">
            <Terminal size={28} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mb-2 text-2xl font-bold text-white">What is a text adventure?</h2>
            <p className="mb-4 leading-relaxed text-slate-400">
              A text adventure (or <em>interactive fiction</em>) is a game where everything happens through text. The game describes where you
              are and what you see; you answer with short commands like <code className="font-mono text-quantum-300">look</code>,{' '}
              <code className="font-mono text-quantum-300">take lamp</code> or <code className="font-mono text-quantum-300">go north</code>. In
              The Quantum Quest each of those commands is also an API call, so you can play by hand or automate your way through.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm">
              {transcript.map(({ cmd, out }) => (
                <div key={cmd} className="mb-2 last:mb-0">
                  <div>
                    <span className="mr-2 text-emerald-400">$</span>
                    <span className="text-slate-200">{cmd}</span>
                  </div>
                  <div className="text-slate-500">{out}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
