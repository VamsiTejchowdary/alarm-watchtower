import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AlarmCardSkeleton() {
  return (
    <Card className="professional-card border-2 border-gray-200">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <Skeleton className="h-3 w-20 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
        
        <div className="pt-2">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}