import svgPaths from "./svg-8me62497ue";
import imgNoise1 from "figma:asset/26cdd9e23150bef60eef0d4cf35c65d128d46af1.png";
import { imgNoise } from "./svg-3vlb9";

function Frame() {
  return (
    <div className="content-stretch flex font-manrope font-medium items-center justify-between leading-[normal] relative shrink-0 text-[16px] w-full">
      <p className="relative shrink-0 text-[rgba(255,255,255,0.4)]">Sunday, Feb 15</p>
      <p className="relative shrink-0 text-[rgba(255,255,255,0.6)]">12:05:38</p>
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[384px]">
      <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[20px] text-[rgba(255,255,255,0.2)] tracking-[-0.3px] w-full">
        <p className="leading-[normal] whitespace-pre-wrap">If the version of you from February 2025 could see today’s entries, what would he admit he was wrong about?</p>
      </div>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex font-manrope font-medium items-center justify-between leading-[normal] relative shrink-0 text-[16px] w-full">
      <p className="relative shrink-0 text-[rgba(255,255,255,0.4)]">Sunday, Feb 15</p>
      <p className="relative shrink-0 text-[rgba(255,255,255,0.6)]">12:05:38</p>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
      <div className="flex flex-col font-inter font-medium justify-center leading-[normal] not-italic relative shrink-0 text-[24px] text-[rgba(255,255,255,0.7)] tracking-[-0.36px] w-full whitespace-pre-wrap">
        <p className="mb-0">Honestly, I think he was wrong about how he measured progress. He only counted outcomes, not effort. Reading that now, it’s obvious he was moving — just not in ways he respected yet. He thought uncertainty meant failure, but it was actually just the early stage of doing something difficult.</p>
        <p className="mb-0">&nbsp;</p>
        <p>I’d tell him: you weren’t behind — you were building tolerance for responsibility. You just didn’t have language for it yet.</p>
      </div>
    </div>
  );
}

function IcBaselineSubdirectoryArrowLeft() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ic:baseline-subdirectory-arrow-left">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ic:baseline-subdirectory-arrow-left">
          <path d={svgPaths.p7d51e00} fill="var(--fill-0, black)" fillOpacity="0.5" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function Frame4() {
  return (
    <div className="bg-[rgba(255,255,255,0.9)] content-stretch flex gap-[8px] items-center justify-center px-[16px] py-[8px] relative rounded-[3px] shrink-0">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <p className="font-inter font-normal leading-[normal] not-italic relative shrink-0 text-[16px] text-black">COMPLETE</p>
      <IcBaselineSubdirectoryArrowLeft />
    </div>
  );
}

function Frame5() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start justify-center relative shrink-0 w-[896px]">
      <Frame6 />
      <Frame3 />
      <Frame7 />
      <Frame4 />
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-end min-h-px min-w-px pb-[256px] relative w-full">
      <Frame5 />
    </div>
  );
}

function MaskGroup() {
  return (
    <div className="absolute bottom-0 contents left-0 top-0" data-name="Mask group">
      <div className="-translate-x-1/2 absolute aspect-[1024/1024] bottom-0 left-1/2 mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_0px] mask-size-[32px_32px] mix-blend-soft-light top-0" data-name="Noise" style={{ maskImage: `url('${imgNoise}')` }}>
        <div className="-translate-y-1/2 absolute aspect-[400/400] left-0 right-0 top-1/2" data-name="Noise">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img alt="" className="absolute left-0 max-w-none size-full top-0" src={imgNoise1} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Div() {
  return (
    <div className="backdrop-blur-[20px] bg-[rgba(235,235,235,0.3)] content-stretch flex items-center justify-center p-[4px] relative rounded-[16px] shrink-0" data-name="Div">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.5)] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="content-stretch flex items-center justify-center relative rounded-[12px] shrink-0 size-[40px]" data-name="App">
        <div className="relative shadow-[0px_0px_2px_0px_rgba(0,0,0,0.15),0px_16px_40px_0px_rgba(0,0,0,0.08)] shrink-0 size-[32px]" data-name="App / Default">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
            <path d={svgPaths.p3ac96b00} fill="var(--fill-0, white)" fillOpacity="0.5" id="Shape" stroke="url(#paint0_linear_1_2034)" />
            <defs>
              <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_1_2034" x1="12.8571" x2="28.7293" y1="4.29571e-07" y2="19.535">
                <stop stopColor="white" stopOpacity="0.3" />
                <stop offset="0.5" stopColor="white" stopOpacity="0.05" />
                <stop offset="1" stopColor="white" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>
          <MaskGroup />
        </div>
      </div>
    </div>
  );
}

function Dock() {
  return (
    <div className="content-stretch flex items-center justify-center relative rounded-[20px] shadow-[0px_100px_106px_0px_rgba(0,0,0,0.05),0px_42px_44px_0px_rgba(0,0,0,0.04),0px_22px_24px_0px_rgba(0,0,0,0.03),0px_12px_12px_0px_rgba(0,0,0,0.03),0px_0px_0px_0px_rgba(0,0,0,0.08)] shrink-0" data-name="Dock">
      <Div />
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
          <Dock />
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_-24px_24px_0px_rgba(0,0,0,0.4)]" />
      <div aria-hidden="true" className="absolute border-2 border-[rgba(0,0,0,0.5)] border-solid inset-0 pointer-events-none rounded-[16px]" />
    </div>
  );
}

export default function Desktop() {
  return (
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 17">
      <Frame1 />
    </div>
  );
}