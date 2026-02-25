import svgPaths from "../../imports/svg-pmue8v1dq9";
import { FadeScreen } from "./shared/screen-primitives";

function ReframeLogo() {
  return (
    <div className="h-[32px] relative shrink-0 w-[162.88px]">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 162.88 32">
        <g id="Frame 5">
          <g id="Vector">
            <path clipRule="evenodd" d={svgPaths.p31973900} fill="white" fillOpacity="0.5" fillRule="evenodd" />
            <path d={svgPaths.p1714e380} fill="white" fillOpacity="0.5" />
            <path d={svgPaths.p1eacbc00} fill="white" fillOpacity="0.5" />
          </g>
          <g id="Reframe">
            <path d={svgPaths.p6408cd0} fill="white" />
            <path d={svgPaths.p2578e500} fill="white" />
            <path d={svgPaths.pc56af80} fill="white" />
            <path d={svgPaths.p2b346800} fill="white" />
            <path d={svgPaths.p3420e380} fill="white" />
            <path d={svgPaths.p5bed180} fill="white" />
            <path d={svgPaths.p13fded80} fill="white" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 19.545 20.001" fill="none">
      <g clipPath="url(#clip0_login)">
        <path d={svgPaths.p66302f0} fill="#4285F4" />
        <path d={svgPaths.p38915e00} fill="#34A853" />
        <path d={svgPaths.p1c84d000} fill="#FBBC05" />
        <path d={svgPaths.p29366300} fill="#EB4335" />
      </g>
      <defs>
        <clipPath id="clip0_login">
          <rect fill="white" height="20.001" width="19.545" />
        </clipPath>
      </defs>
    </svg>
  );
}

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <FadeScreen className="content-stretch">
      <div className="flex flex-col gap-[48px] items-center">
        <div className="flex flex-col gap-[7px] items-center">
          <div className="flex gap-[8px] items-center justify-center">
            <p className="font-manrope font-semibold leading-[normal] text-[32px] text-white">Get started with</p>
            <ReframeLogo />
          </div>
          <p className="font-manrope font-semibold leading-[normal] text-[20px] text-[rgba(255,255,255,0.4)]">Create your free account to get started</p>
        </div>

        <div className="flex flex-col gap-[12px] w-[384px]">
          <button
            onClick={onLogin}
            className="bg-white rounded-[2px] w-full flex items-center justify-center gap-[12px] p-[16px] cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <GoogleLogo />
            <span className="font-manrope font-medium text-[20px] text-[rgba(0,0,0,0.9)] tracking-[-0.4px]">Continue with Google</span>
          </button>
          <div className="flex gap-[8px] w-full">
            <button
              onClick={onLogin}
              className="flex-1 bg-[rgba(255,255,255,0.1)] rounded-[2px] p-[16px] cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors"
            >
              <span className="font-manrope font-semibold text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.4px]">Sign up</span>
            </button>
            <button
              onClick={onLogin}
              className="flex-1 bg-[rgba(255,255,255,0.1)] rounded-[2px] p-[16px] cursor-pointer hover:bg-[rgba(255,255,255,0.15)] transition-colors"
            >
              <span className="font-manrope font-semibold text-[20px] text-[rgba(255,255,255,0.9)] tracking-[-0.4px]">Log in</span>
            </button>
          </div>
        </div>
      </div>
    </FadeScreen>
  );
}
