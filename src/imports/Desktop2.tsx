function Frame() {
  return (
    <div className="content-stretch flex font-manrope font-medium items-center justify-between leading-[normal] relative shrink-0 text-[16px] w-full">
      <p className="relative shrink-0 text-[rgba(255,255,255,0.4)]">Sunday, Feb 15</p>
      <p className="relative shrink-0 text-[rgba(255,255,255,0.6)]">12:05</p>
    </div>
  );
}

function Frame11() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
      <div className="flex flex-col font-manrope font-semibold justify-center leading-[0] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] w-full">
        <p className="leading-[normal] whitespace-pre-wrap">On a scale of 1-5, how grateful are you feeling today?</p>
      </div>
    </div>
  );
}

function Frame12() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
      <Frame11 />
    </div>
  );
}

function Frame5() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative rounded-[3px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[24px] py-[12px] relative w-full">
          <p className="font-manrope font-medium leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)]">1</p>
        </div>
      </div>
    </div>
  );
}

function Frame6() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative rounded-[3px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[24px] py-[12px] relative w-full">
          <p className="font-manrope font-medium leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)]">2</p>
        </div>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative rounded-[3px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[24px] py-[12px] relative w-full">
          <p className="font-manrope font-medium leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)]">3</p>
        </div>
      </div>
    </div>
  );
}

function Frame8() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative rounded-[3px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[24px] py-[12px] relative w-full">
          <p className="font-manrope font-medium leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)]">4</p>
        </div>
      </div>
    </div>
  );
}

function Frame9() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative rounded-[3px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[24px] py-[12px] relative w-full">
          <p className="font-manrope font-medium leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)]">5</p>
        </div>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full">
      <Frame5 />
      <Frame6 />
      <Frame7 />
      <Frame8 />
      <Frame9 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-[384px]">
      <p className="font-manrope font-semibold leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.6)]">Good evening, Raghav.</p>
      <Frame12 />
      <Frame4 />
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex flex-col items-start justify-center relative shrink-0 w-[896px]">
      <Frame3 />
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px relative w-full">
      <Frame10 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-gradient-to-b flex-[1_0_0] from-[#1e1e1e] min-h-px min-w-px relative rounded-[16px] to-[rgba(30,30,30,0.8)] w-full">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[10px] items-start p-[24px] relative size-full">
          <Frame />
          <Frame2 />
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_-24px_24px_0px_rgba(0,0,0,0.4)]" />
      <div aria-hidden="true" className="absolute border-2 border-[rgba(0,0,0,0.5)] border-solid inset-0 pointer-events-none rounded-[16px]" />
    </div>
  );
}

export default function Desktop() {
  return (
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 2">
      <Frame1 />
    </div>
  );
}