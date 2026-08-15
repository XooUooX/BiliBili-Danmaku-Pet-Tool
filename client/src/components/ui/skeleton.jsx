import { cn } from '@/lib/utils';
import { TableRow, TableCell } from '@/components/ui/table';

// 单个骨架块
function Skeleton({ className, ...props }) {
  return <div className={cn('animate-shimmer rounded-md', className)} {...props} />;
}

// 表格加载骨架：填充若干行、若干列的灰块
function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// 卡片/整页加载骨架
function CardSkeleton({ className }) {
  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export { Skeleton, TableSkeleton, CardSkeleton };
