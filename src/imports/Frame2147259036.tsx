import svgPaths from "./svg-nigduusfhj";

function IcBaselineArrowBackIos() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="ic:baseline-arrow-back-ios">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="ic:baseline-arrow-back-ios">
          <path d={svgPaths.p1bacaf0} fill="var(--fill-0, white)" fillOpacity="0.1" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function IcBaselineArrowBackIos1() {
  return (
    <div className="relative size-[12px]" data-name="ic:baseline-arrow-back-ios">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="ic:baseline-arrow-back-ios">
          <path d={svgPaths.p1bacaf0} fill="var(--fill-0, white)" fillOpacity="0.4" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0">
      <IcBaselineArrowBackIos />
      <p className="font-roboto-mono font-medium leading-[normal] relative shrink-0 text-[12px] text-[rgba(255,255,255,0.4)]">1/3</p>
      <div className="flex items-center justify-center relative shrink-0">
        <div className="-scale-y-100 flex-none rotate-180">
          <IcBaselineArrowBackIos1 />
        </div>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
      <Frame1 />
      <p className="font-roboto-mono font-medium leading-[normal] relative shrink-0 text-[12px] text-[rgba(255,255,255,0.4)]">AUGUST 16 2025</p>
    </div>
  );
}

export default function Frame2() {
  return (
    <div className="bg-[#1e1e1e] relative rounded-[8px] size-full">
      <div className="content-stretch flex flex-col gap-[19px] items-start overflow-clip p-[24px] relative rounded-[inherit] size-full">
        <Frame />
        <p className="font-pangolin leading-[1.5] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.6)] w-full whitespace-pre-wrap">I feel stuck again. I keep thinking I should be further ahead by now. Everyone else seems to be building something real, and I’m just trying.</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}