import svgPaths from "./svg-pmue8v1dq9";

function Frame5() {
  return (
    <div className="h-[32px] relative shrink-0 w-[162.88px]">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 162.88 32">
        <g id="Frame 5">
          <g id="Vector">
            <path clipRule="evenodd" d={svgPaths.p31973900} fill="var(--fill-0, white)" fillOpacity="0.5" fillRule="evenodd" />
            <path d={svgPaths.p1714e380} fill="var(--fill-0, white)" fillOpacity="0.5" />
            <path d={svgPaths.p1eacbc00} fill="var(--fill-0, white)" fillOpacity="0.5" />
          </g>
          <g id="Reframe">
            <path d={svgPaths.p6408cd0} fill="var(--fill-0, white)" />
            <path d={svgPaths.p2578e500} fill="var(--fill-0, white)" />
            <path d={svgPaths.pc56af80} fill="var(--fill-0, white)" />
            <path d={svgPaths.p2b346800} fill="var(--fill-0, white)" />
            <path d={svgPaths.p3420e380} fill="var(--fill-0, white)" />
            <path d={svgPaths.p5bed180} fill="var(--fill-0, white)" />
            <path d={svgPaths.p13fded80} fill="var(--fill-0, white)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex gap-[8px] items-center justify-center relative shrink-0">
      <p className="font-manrope font-semibold leading-[normal] relative shrink-0 text-[32px] text-white">Get started with</p>
      <Frame5 />
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col gap-[7px] items-center relative shrink-0">
      <Frame4 />
      <p className="font-manrope font-semibold leading-[normal] relative shrink-0 text-[20px] text-[rgba(255,255,255,0.4)]">Create your free account to get started</p>
    </div>
  );
}

function GoogleLogo() {
  return (
    <div className="absolute inset-[0_2.28%_-0.01%_0]" data-name="Google logo">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.545 20.001">
        <g clipPath="url(#clip0_1_1621)" id="Google logo">
          <path d={svgPaths.p66302f0} fill="var(--fill-0, #4285F4)" id="Vector" />
          <path d={svgPaths.p38915e00} fill="var(--fill-0, #34A853)" id="Vector_2" />
          <path d={svgPaths.p1c84d000} fill="var(--fill-0, #FBBC05)" id="Vector_3" />
          <path d={svgPaths.p29366300} fill="var(--fill-0, #EB4335)" id="Vector_4" />
        </g>
        <defs>
          <clipPath id="clip0_1_1621">
            <rect fill="white" height="20.001" width="19.545" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Icon() {
  return (
    <div className="overflow-clip relative shrink-0 size-[20px]" data-name="Icon">
      <GoogleLogo />
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex items-center justify-center px-[4px] relative shrink-0" data-name="Container">
      <div className="flex flex-col font-manrope font-medium justify-center leading-[0] overflow-hidden relative shrink-0 text-[20px] text-[rgba(0,0,0,0.9)] text-center text-ellipsis tracking-[-0.4px] w-[197px] whitespace-nowrap">
        <p className="leading-[20px] overflow-hidden">Continue with Google</p>
      </div>
    </div>
  );
}

function Frame8() {
  return (
    <div className="bg-white relative rounded-[2px] shrink-0 w-full">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[12px] items-center justify-center p-[16px] relative w-full">
          <Icon />
          <Container />
        </div>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] flex-[1_0_0] min-h-px min-w-px relative rounded-[2px]">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative w-full">
          <div className="flex flex-col font-manrope font-semibold justify-center leading-[0] overflow-hidden relative shrink-0 text-[20px] text-[rgba(255,255,255,0.9)] text-center text-ellipsis tracking-[-0.4px] whitespace-nowrap">
            <p className="leading-[20px] overflow-hidden">Sign up</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame11() {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] flex-[1_0_0] min-h-px min-w-px relative rounded-[2px]">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative w-full">
          <div className="flex flex-col font-manrope font-semibold justify-center leading-[0] overflow-hidden relative shrink-0 text-[20px] text-[rgba(255,255,255,0.9)] text-center text-ellipsis tracking-[-0.4px] whitespace-nowrap">
            <p className="leading-[20px] overflow-hidden">Log in</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full">
      <Frame10 />
      <Frame11 />
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full">
      <Frame8 />
      <Frame7 />
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0 w-[384px]">
      <Frame9 />
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-col gap-[48px] items-center relative shrink-0">
      <Frame3 />
      <Frame6 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px relative w-full">
      <Frame2 />
    </div>
  );
}

function Frame() {
  return (
    <div className="bg-gradient-to-b flex-[1_0_0] from-[#1e1e1e] min-h-px min-w-px relative rounded-[16px] to-[rgba(30,30,30,0.8)] w-full">
      <div className="flex flex-col items-end justify-end overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-end justify-end p-[24px] relative size-full">
          <Frame1 />
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_-24px_24px_0px_rgba(0,0,0,0.4)]" />
      <div aria-hidden="true" className="absolute border-2 border-[rgba(0,0,0,0.5)] border-solid inset-0 pointer-events-none rounded-[16px]" />
    </div>
  );
}

export default function Desktop() {
  return (
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#ede9e5] items-center justify-center p-[48px] relative size-full to-[#dad3cd]" data-name="Desktop - 32">
      <Frame />
    </div>
  );
}