import svgPaths from "./svg-o33f79wigb";

function Frame() {
  return (
    <div className="content-stretch flex font-manrope font-medium items-center justify-between leading-[normal] relative shrink-0 text-[16px] w-full">
      <p className="relative shrink-0 text-[rgba(255,255,255,0.4)]">Sunday, Feb 15</p>
      <p className="relative shrink-0 text-[rgba(255,255,255,0.6)]">12:05:38</p>
    </div>
  );
}

function Frame5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0">
      <p className="font-roboto-mono font-medium leading-[normal] relative shrink-0 text-[12px] text-[rgba(255,255,255,0.4)]">OCTOBER 2024, A YEAR AGO</p>
    </div>
  );
}

function Frame7() {
  return (
    <div className="h-[4px] relative shrink-0 w-full">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 512 4">
        <g id="Frame 1">
          <g id="Vector">
            <path d="M0 0L8.82759 4H0V0Z" fill="var(--fill-0, #DED2C3)" />
            <path d={svgPaths.pdc47380} fill="var(--fill-0, #DED2C3)" />
            <path d="M512 0L503.172 4H512V0Z" fill="var(--fill-0, #DED2C3)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame8() {
  return (
    <div className="bg-[#ded2c3] relative shrink-0 w-full">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-center flex flex-wrap items-center justify-center p-[48px] relative w-full">
          <p className="flex-[1_0_0] font-pangolin leading-[1.5] min-h-px min-w-px not-italic relative text-[20px] text-[rgba(0,0,0,0.4)] whitespace-pre-wrap">I feel stuck again. I keep thinking I should be further ahead by now. Everyone else seems to be building something real, and I’m just trying.</p>
        </div>
      </div>
    </div>
  );
}

function Frame9() {
  return (
    <div className="h-[4px] relative w-full">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 512 4">
        <g id="Frame 1">
          <g id="Vector">
            <path d="M0 0L8.82759 4H0V0Z" fill="var(--fill-0, #DED2C3)" />
            <path d={svgPaths.pdc47380} fill="var(--fill-0, #DED2C3)" />
            <path d="M512 0L503.172 4H512V0Z" fill="var(--fill-0, #DED2C3)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[512px]">
      <Frame7 />
      <Frame8 />
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="-scale-y-100 flex-none w-full">
          <Frame9 />
        </div>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-center justify-center relative shrink-0">
      <Frame5 />
      <Frame6 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0">
      <Frame4 />
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-end min-h-px min-w-px pb-[256px] relative w-full">
      <Frame3 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-gradient-to-b flex-[1_0_0] from-[#1e1e1e] min-h-px min-w-px relative rounded-[16px] to-[rgba(30,30,30,0.8)] w-full">
      <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[10px] items-center justify-center p-[24px] relative size-full">
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
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 11">
      <Frame1 />
    </div>
  );
}