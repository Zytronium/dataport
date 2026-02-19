import Image from "next/image";

function Console() {
  return (
    <div
      className="flex flex-col scanlines items-start gap-1 rounded-2xl bg-zinc-950
      border border-zinc-700 w-[80vw] h-[80vh] p-4"
      id="console"
    >
      <div className="flex flex-col gap-1" id="console-text">
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div
      className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-row gap-1 justify-center items-center py-2">
        <Image src="/logo.png" width={24} height={24} alt="DATAPORT.exe logo" />
        <p className="text-zinc-400">DATAPORT.exe</p>
      </div>
      <Console />
    </div>
  );
}
