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
    <div className={`flex flex-col items-center ${className}`}>
      <Image
        src="/logo-zocyal.svg"
        alt="Zocyal"
        width={dimensions.width}
        height={dimensions.height}
        priority
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