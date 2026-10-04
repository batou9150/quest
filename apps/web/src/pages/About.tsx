import { Bot, Code2, Target } from 'lucide-react';
import { Link } from 'react-router';

const pillars = [
  { icon: Target, title: 'Our mission', text: 'Make exploring APIs, scripting and agent design feel like a game — because it is one.', color: 'text-quantum-400 bg-quantum-950' },
  { icon: Bot, title: 'Humans and agents', text: 'Every level can be played by hand in the browser or by a program talking to the same HTTP API.', color: 'text-accent-300 bg-accent-950' },
  { icon: Code2, title: 'Open by design', text: 'A documented OpenAPI spec, plain JSON and API keys: no SDK required.', color: 'text-amber-300 bg-amber-950' },
];

export function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">About The Quantum Quest</h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">
          A gamified challenge platform built around a classic idea: the text adventure, reimagined as an API.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, text, color }) => (
          <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${color}`}>
              <Icon size={24} aria-hidden />
            </div>
            <h2 className="mb-2 font-bold text-white">{title}</h2>
            <p className="text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-slate-400">
          <li>
            <Link to="/login" className="text-quantum-400 hover:underline">Connect</Link> with Google or GitHub.
          </li>
          <li>
            Pick a level in <Link to="/level-select" className="text-quantum-400 hover:underline">Level Select</Link>. Levels unlock one after
            another.
          </li>
          <li>Play it in the web terminal, or generate an API key and play with curl, a script or an AI agent.</li>
          <li>Finish in fewer actions for a higher score, and climb the event leaderboards.</li>
        </ol>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">Creators &amp; contact</h2>
        <p className="text-slate-400">
          The Quantum Quest is an open-source project created by Baptiste Pirault and released under the MIT licence. Found a bug in the
          simulation or have an idea for a level? Open an issue on the project repository.
        </p>
      </div>
    </div>
  );
}
