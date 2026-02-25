import svgPaths from "./svg-a41tarbocg";
import imgNoise1 from "figma:asset/26cdd9e23150bef60eef0d4cf35c65d128d46af1.png";
import { imgNoise } from "./svg-g6p7p";

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
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
      <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.3px] w-full">
        <p className="leading-[normal] whitespace-pre-wrap">What would you like to do today?</p>
      </div>
    </div>
  );
}

function Frame12() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
      <Frame6 />
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] shrink-0 w-[35px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <p className="font-inter font-normal leading-[normal] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)]">1</p>
    </div>
  );
}

function Frame8() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col font-inter font-medium gap-[4px] items-start leading-[0] min-h-px min-w-px not-italic relative">
      <div className="flex flex-col justify-center relative shrink-0 text-[16px] text-[rgba(255,255,255,0.9)] w-[312px]">
        <p className="leading-[normal] whitespace-pre-wrap">REFLECT</p>
      </div>
      <div className="flex flex-col justify-center min-w-full relative shrink-0 text-[14px] text-[rgba(255,255,255,0.6)] w-[min-content]">
        <p className="leading-[normal] whitespace-pre-wrap">We explore sites, ask questions, and run through your workflow together</p>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex gap-[24px] items-center opacity-10 relative shrink-0 w-full">
      <Frame9 />
      <Frame8 />
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center px-[16px] py-[8px] relative rounded-[3px] shrink-0 w-[35px]">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[3px]" />
      <p className="font-inter font-normal leading-[normal] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)]">2</p>
    </div>
  );
}

function Frame13() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col font-inter font-medium gap-[4px] items-start leading-[0] min-h-px min-w-px not-italic relative">
      <div className="flex flex-col justify-center relative shrink-0 text-[16px] text-[rgba(255,255,255,0.9)] w-full">
        <p className="leading-[normal] whitespace-pre-wrap">WRITE</p>
      </div>
      <div className="flex flex-col justify-center relative shrink-0 text-[14px] text-[rgba(255,255,255,0.6)] w-full">
        <p className="leading-[normal] whitespace-pre-wrap">{`We write optimized code that's faster, cheaper, and more reliable`}</p>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex gap-[24px] items-center relative shrink-0 w-full">
      <Frame4 />
      <Frame13 />
    </div>
  );
}

function Frame11() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full">
      <Frame7 />
      <Frame10 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-[384px]">
      <Frame12 />
      <Frame11 />
    </div>
  );
}

function Frame5() {
  return (
    <div className="content-stretch flex flex-col items-start justify-center relative shrink-0 w-[896px]">
      <Frame3 />
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
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 19">
      <Frame1 />
    </div>
  );
}