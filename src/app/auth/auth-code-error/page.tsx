import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

export default function AuthCodeErrorPage() {
  return (
    <div className="app-shell">
      <div className="w-full max-w-md">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle>Authentication failed</CardTitle>
            <CardDescription>
              We could not complete sign in. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This usually happens when the auth code is expired or your callback URL is not configured.
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/auth/login">Back to login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
