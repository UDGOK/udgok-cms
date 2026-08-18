export function TestimonialsBlock() {
  const quotes = [
    {
      q: 'We replaced four apps with UDGOK. Foremen finally adopted it because the mobile UX is the only one that doesn&apos;t make them want to throw their phone.',
      a: 'Yasir K.',
      r: 'Owner, UDGOK Construction',
    },
    {
      q: 'The pay app flow is magic. Generate, send, and watch clients open and sign in real time. We get paid days faster.',
      a: 'Foreman Mike',
      r: 'Coldstone Renovation project',
    },
    {
      q: 'GPS photos changed everything. No more "where\'s the master bath rough-in?" — it\'s all there, tagged, in the project.',
      a: 'Office Lead',
      r: 'Field & Co.',
    },
  ];

  return (
    <section className="px-5 md:px-8 py-20 md:py-28 bg-paper border-t-2 border-ink">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-orange-d mb-3 font-bold">
            {'// From the field'}
          </div>
          <h2 className="font-black tracking-[-0.02em] text-4xl sm:text-5xl leading-[1.05]">
            What crews are saying.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {quotes.map((t, i) => (
            <div key={i} className="bg-cream-2 border-2 border-ink p-5 md:p-6">
              <p className="text-[16px] md:text-[17px] font-bold leading-snug mb-4 tracking-tight">
                &ldquo;{t.q.split('UDGOK')[0]}
                <span className="font-serif italic text-orange-d">UDGOK</span>
                {t.q.split('UDGOK')[1] ?? t.q.split('foremen ')[1] ?? ''}&rdquo;
              </p>
              <div className="pt-3 border-t border-line">
                <div className="font-extrabold text-[13px]">{t.a}</div>
                <div className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.05em]">
                  {t.r}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
