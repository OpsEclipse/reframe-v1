function Frame() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col h-full items-center justify-center min-h-px min-w-px relative">
      <p className="font-manrope font-semibold leading-[normal] relative shrink-0 text-[24px] text-[rgba(255,255,255,0.9)]">Good evening, Raghav.</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-gradient-to-b flex-[1_0_0] from-[#1e1e1e] min-h-px min-w-px relative rounded-[16px] to-[rgba(30,30,30,0.8)] w-full">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[384px] py-[64px] relative size-full">
          <Frame />
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_-24px_24px_0px_rgba(0,0,0,0.4)]" />
      <div aria-hidden="true" className="absolute border-2 border-[rgba(0,0,0,0.5)] border-solid inset-0 pointer-events-none rounded-[16px]" />
    </div>
  );
}

export default function Desktop() {
  return (
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 1">
      <Frame1 />
    </div>
  );
}