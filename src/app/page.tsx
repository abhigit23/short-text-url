import PasteEditor from "@/components/paste-editor";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6">
      <div className="w-full max-w-3xl">
        <header className="mb-6 pt-4 text-center sm:mb-8 sm:pt-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">s.at</h1>
          <p className="mt-2 text-sm text-zinc-500 sm:text-base dark:text-zinc-400">
            Share short, self-destructing pastes
          </p>
        </header>
        <PasteEditor />
      </div>
    </main>
  );
}
