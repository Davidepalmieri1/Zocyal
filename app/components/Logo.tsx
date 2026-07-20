import Image from "next/image"

type LogoProps = {
  size?: "small" | "medium" | "large"
  showText?: boolean
  className?: string
}

const sizes = {
  small: {
    width: 70,
    height: 52,
  },
  medium: {
    width: 110,
    height: 81,
  },
  large: {
    width: 145,
    height: 106,
  },
}

export default function Logo({
  size = "medium",
  showText = false,
  className = "",
}: LogoProps) {
  const dimensions = sizes[size]

  return (
    <div className={`group relative flex flex-col items-center ${className}`}>
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/20 opacity-0 blur-2xl transition duration-500 group-hover:opacity-100" />
      <Image
        src="/logo-zocyal.svg"
        alt="Zocyal"
        width={dimensions.width}
        height={dimensions.height}
        priority
        className="drop-shadow-[0_8px_28px_rgba(233,43,147,.22)] transition duration-500 group-hover:scale-[1.04]"
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
      />

      {showText && (
        <span className="mt-2 text-xs font-semibold tracking-[0.25em] text-white/60">
          CONNETTI. VIVI. CONDIVIDI.
        </span>
      )}
    </div>
  )
}
