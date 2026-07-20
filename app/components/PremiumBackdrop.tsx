type PremiumBackdropProps = {
  orbs?: boolean
}

export default function PremiumBackdrop({ orbs = true }: PremiumBackdropProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="premium-grid" />
      <div className="premium-aurora premium-aurora--pink" />
      <div className="premium-aurora premium-aurora--violet" />
      <div className="premium-aurora premium-aurora--orange" />
      {orbs && (
        <>
          <div className="premium-orb right-[7%] top-[13%] h-24 w-24 opacity-60 sm:h-40 sm:w-40" />
          <div className="premium-orb bottom-[13%] left-[5%] h-14 w-14 opacity-35 [animation-delay:-3s] sm:h-24 sm:w-24" />
        </>
      )}
    </div>
  )
}
