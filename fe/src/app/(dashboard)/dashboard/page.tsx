import { AttendanceTrend } from '@/components/attendance-trend';
import { DashboardFilterProvider, DateRangeFilter, FilterToggle } from '@/components/dashboard-filter';
import { ClassBreakdown, PrayerCard, TapQualityCard } from '@/components/dashboard-panels';
import { RecentTaps } from '@/components/recent-taps';
import { PopulationCard, RateCard, StatsCards } from '@/components/stats-cards';

export default function DashboardPage() {
  return (
    <DashboardFilterProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ringkasan Absensi</h2>
            <p className="text-sm text-slate-500">
              Pilih rentang tanggal dan kelompok orang — semua panel mengikuti.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterToggle />
            <DateRangeFilter />
          </div>
        </div>

        <StatsCards />

        <div className="grid gap-4 lg:grid-cols-3">
          <RateCard />
          <PopulationCard />
          <TapQualityCard />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <AttendanceTrend />
          <RecentTaps />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ClassBreakdown />
          <PrayerCard />
        </div>
      </div>
    </DashboardFilterProvider>
  );
}
