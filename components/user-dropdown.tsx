"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon } from "lucide-react";

type UserProfile = {
  name: string | null;
  email: string | null;
  image: string | null;
};

export function UserDropdown() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false); // so we don't refetch on every page change

  useEffect(() => {
    if (status !== "authenticated" || loaded) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;

        const json = await res.json();
        setProfile(json.user as UserProfile);
        setLoaded(true);
      } catch (error) {
        console.error("Error fetching user profile in dropdown:", error);
      }
    };

    fetchProfile();
  }, [status, loaded]);

  if (status !== "authenticated") {
    return null;
  }

  const displayName =
    profile?.name || session?.user?.name || "User";

  const email =
    profile?.email || session?.user?.email || "";

  const avatarSrc =
    profile?.image || session?.user?.image || "";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8 rounded-full overflow-hidden">
            <AvatarImage
              src={avatarSrc}
              className="h-full w-full object-cover"
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium truncate">
            {displayName}
          </span>
          {email && (
            <span className="text-xs text-muted-foreground truncate">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/profile")}
          className="cursor-pointer"
        >
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            signOut({
              callbackUrl: "/auth/signin",
            })
          }
          className="cursor-pointer text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
