import { Suspense } from 'react';
import { AttendanceTrend } from '@/components/attendance-trend';
import { DashboardFilterProvider, DateRangeFilter, FilterToggle } from '@/components/dashboard-filter';
import { ClassBreakdown, PrayerCard, TapQualityCard } from '@/components/dashboard-panels';
import { RecentTaps } from '@/components/recent-taps';
import { PopulationCard, RateCard, StatsCards } from '@/components/stats-cards';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <DashboardFilterProvider>
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <PageHeader
            eyebrow="Operasional"
            title="Ringkasan Absensi"
            description="Pilih rentang tanggal dan kelompok orang — semua panel mengikuti."
            actions={
              <>
                <FilterToggle />
                <DateRangeFilter />
              </>
            }
          />

          <StatsCards />

          <div className="grid gap-4 lg:grid-cols-3">
            <RateCard />
            <PopulationCard />
            <TapQualityCard />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AttendanceTrend />
            <RecentTaps />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ClassBreakdown />
            <PrayerCard />
          </div>
        </div>
      </DashboardFilterProvider>
    </Suspense>
  );
}
