import Image from "next/image";

type CountryFlagProps = {
  code?: string | null;
  name: string;
  sizeClassName?: string;
};

export function CountryFlag({
  code,
  name,
  sizeClassName = "h-8 w-8",
}: CountryFlagProps) {
  const normalizedCode = code?.toLowerCase();
  const isValidCode = Boolean(normalizedCode && /^[a-z]{2}$/.test(normalizedCode));

  if (!isValidCode) {
    return (
      <span
        className={`inline-flex ${sizeClassName} items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400`}
        aria-label={`${name} ainda nao definido`}
      >
        ?
      </span>
    );
  }

  return (
    <Image
      src={`https://flagcdn.com/${normalizedCode}.svg`}
      alt={`Bandeira de ${name}`}
      width={40}
      height={40}
      unoptimized
      className={`${sizeClassName} rounded-full object-cover ring-1 ring-white/10`}
    />
  );
}
