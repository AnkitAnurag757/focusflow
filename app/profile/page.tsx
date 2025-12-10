"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Calendar,
  Target,
  TrendingUp,
  Award,
  Clock,
  Camera,
  Save,
  Loader2,
  MoonIcon,
  CrossIcon,
  CrosshairIcon,
  DeleteIcon,
} from "lucide-react";
import { Header } from "@/components/header";
import { useSettingsContext } from "@/contexts/settings-context";

type StatsState = {
  totalSessions: number;
  totalFocusTime: number; // minutes
  averageFocus: number;
  currentStreak: number;
  bestStreak: number;
};

type FormState = {
  name: string;
  email: string;
  focusGoal: number;
  breakDuration: number;
  dailyTarget: number;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  image: string | null;
  preferences?: {
    focusGoal?: number;
    breakDuration?: number;
    dailyTarget?: number;
  };
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const {
    settings,
    updateSettings,
    isLoading: settingsLoading,
  } = useSettingsContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [stats, setStats] = useState<StatsState>({
    totalSessions: 0,
    totalFocusTime: 0,
    averageFocus: 0,
    currentStreak: 0,
    bestStreak: 0,
  });

  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    focusGoal: 25,
    breakDuration: 5,
    dailyTarget: 4,
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated" && !settingsLoading) {
      fetchUserProfile();
      fetchUserStats();
    }
  }, [status, settingsLoading, router]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) return;
      const json = await res.json();
      const user = json.user as UserProfile;

      setUserProfile(user);

      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        focusGoal:
          settings.focusDuration ??
          user.preferences?.focusGoal ??
          prev.focusGoal,
        breakDuration:
          settings.shortBreakDuration ??
          user.preferences?.breakDuration ??
          prev.breakDuration,
        dailyTarget: user.preferences?.dailyTarget ?? prev.dailyTarget,
      }));

      if (user.image) {
        setAvatarPreview(user.image);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch("/api/users/me/stats");
      if (!response.ok) return;

      const json = await response.json();
      const apiStats = json.stats || {};

      setStats({
        totalSessions: apiStats.totalSessions ?? 0,
        totalFocusTime: apiStats.totalFocusTime ?? 0, // minutes
        averageFocus: apiStats.averageFocus ?? 0,
        currentStreak: apiStats.currentStreak ?? 0,
        bestStreak: apiStats.bestStreak ?? 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarData(result);
    };
    reader.readAsDataURL(file);
  };
  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarData(""); // special value meaning "clear image"
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1) Update app-wide timer settings (used by timer-interface)
      await updateSettings({
        focusDuration: formData.focusGoal,
        shortBreakDuration: formData.breakDuration,
      });

      // 2) Update profile in DB (name, prefs, avatar)
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          focusGoal: formData.focusGoal,
          breakDuration: formData.breakDuration,
          dailyTarget: formData.dailyTarget,
          image: avatarData, // can be null; backend will handle
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        // refresh local profile (so the avatar persists across reloads)
        await fetchUserProfile();
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const userInitials = (userProfile?.name || session?.user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const achievements = [
    {
      name: "First Focus",
      description: "Complete your first session",
      icon: Target,
      unlocked: stats.totalSessions >= 1,
    },
    {
      name: "Week Warrior",
      description: "7 day streak",
      icon: TrendingUp,
      unlocked: stats.currentStreak >= 7,
    },
    {
      name: "Focus Master",
      description: "Average focus above 80%",
      icon: Award,
      unlocked: stats.averageFocus >= 80 && stats.totalSessions >= 5,
    },
    {
      name: "Early Bird",
      description: "Start a session before 6 AM (hook later with timestamps)",
      icon: Clock,
      unlocked: false,
    },
    {
      name: "Night Owl",
      description: "Focus after midnight",
      icon: MoonIcon,
      unlocked: false,
    },
    {
      name: "Marathon",
      description: "4+ hours of total focus",
      icon: Target,
      unlocked: stats.totalFocusTime >= 240,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Profile Header */}
        <div className="mb-8">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-background">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-3">
                  <Avatar
                    className="h-24 w-24 rounded-full ring-4 ring-background shadow-xl cursor-pointer overflow-hidden"
                    onClick={() =>
                      document.getElementById("avatarUpload")?.click()
                    }
                  >
                    <AvatarImage
                      src={
                        avatarPreview ||
                        userProfile?.image ||
                        session?.user?.image ||
                        ""
                      }
                      className="h-full w-full object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-2xl">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>

                  <input
                    id="avatarUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />

                  <div className="flex flex-col items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("avatarUpload")?.click()
                      }
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive "
                      onClick={handleRemovePhoto}
                      disabled={isSaving}
                    >
                      <DeleteIcon className="h-4 w-4 mr-2" />
                      Remove photo
                    </Button>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold">
                    {userProfile?.name || session?.user?.name}
                  </h1>
                  <p className="text-muted-foreground">
                    {userProfile?.email || session?.user?.email}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      Member since {new Date().toLocaleDateString()}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Target className="h-3 w-3" />
                      {stats.totalSessions} Sessions
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(stats.totalFocusTime)}
                    </Badge>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    isEditing ? handleSave() : setIsEditing(true)
                  }
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isEditing ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  {isEditing ? "Save Changes" : "Edit Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Focus Time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTime(stats.totalFocusTime)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Average Focus</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageFocus}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Great performance!
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Current Streak</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.currentStreak} days
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keep it up!
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Best Streak</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.bestStreak} days
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Personal record
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Focus Preferences</CardTitle>
                <CardDescription>Customize your focus sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="focusGoal">Focus Duration (minutes)</Label>
                    <Input
                      id="focusGoal"
                      type="number"
                      value={formData.focusGoal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          focusGoal: parseInt(e.target.value || "0"),
                        })
                      }
                      disabled={!isEditing}
                      min={1}
                      max={60}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="breakDuration">
                      Break Duration (minutes)
                    </Label>
                    <Input
                      id="breakDuration"
                      type="number"
                      value={formData.breakDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          breakDuration: parseInt(e.target.value || "0"),
                        })
                      }
                      disabled={!isEditing}
                      min={1}
                      max={30}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dailyTarget">Daily Session Target</Label>
                    <Input
                      id="dailyTarget"
                      type="number"
                      value={formData.dailyTarget}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dailyTarget: parseInt(e.target.value || "0"),
                        })
                      }
                      disabled={!isEditing}
                      min={1}
                      max={20}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Camera Detection</Label>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!isEditing}
                      type="button"
                      onClick={() => {
                        router.push("/test-camera");
                      }}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Configure Camera
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement, index) => (
                <Card
                  key={index}
                  className={achievement.unlocked ? "" : "opacity-50"}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          achievement.unlocked
                            ? "bg-primary/10 text-primary"
                            : "bg-muted"
                        }`}
                      >
                        <achievement.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {achievement.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {achievement.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
