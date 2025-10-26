'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function ClientLoginForm() {
	const [userId, setUserId] = useState('');
	const [password, setPassword] = useState('');
	const [captcha, setCaptcha] = useState('');
	const [generatedCaptcha, setGeneratedCaptcha] = useState('');
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	// Generate captcha
	const generateCaptcha = () => {
		const newCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit
		setGeneratedCaptcha(newCode);
		setCaptcha('');
	};

	useEffect(() => { generateCaptcha(); }, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setErr(null);

		const uid = userId.trim().toUpperCase();
		const pwd = password;

		if (!uid || !pwd) {
			setErr('User ID and password are required.');
			setLoading(false);
			return;
		}
		if (captcha !== generatedCaptcha) {
			setErr('Invalid captcha. Please try again.');
			setLoading(false);
			return;
		}

		//debugger;
		const res = await signIn('credentials', {
			redirect: false,
			userId: uid,
			password: pwd,
			callbackUrl: '/dashboard',
		});

		if (res?.error) {
			setErr(res.error === 'CredentialsSignin' ? 'Invalid credentials' : res.error);
			setLoading(false);
			return;
		}

		// success
		if (res?.url) {
			window.location.href = res.url;
		}
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-sky-100 to-sky-200">
			<div className="bg-white rounded-2xl shadow-lg flex w-[900px] max-w-full overflow-hidden">
				{/* Left side: form */}
				<div className="flex-1 p-10">
					<h2 className="text-2xl font-bold mb-6">Log In</h2>

					<form onSubmit={onSubmit} className="space-y-4">
						{/* User ID */}
						<div>
							<label htmlFor="userId" className="block text-sm font-medium mb-1">User ID</label>
							<input
								id="userId"
								type="text"
								placeholder="Enter User ID (e.g., U0001-LB01 or OP0001)"
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
								className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
								autoComplete="username"
							/>
						</div>

						{/* Password */}
						<div>
							<label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
							<input
								type="password"
								placeholder="Enter Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
								autoComplete="current-password"
							/>
						</div>

						{/* Captcha */}
						<div className="flex items-center gap-3">
							<div className="font-bold text-2xl tracking-widest select-none">
								{generatedCaptcha}
							</div>
							<input
								type="text"
								placeholder="Enter Captcha Code"
								value={captcha}
								onChange={(e) => setCaptcha(e.target.value)}
								className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
								inputMode="numeric"
							/>
							<button
								type="button"
								onClick={generateCaptcha}
								className="p-2 border rounded-lg hover:bg-gray-100"
								aria-label="Refresh captcha"
								title="Refresh captcha"
							>
								⟳
							</button>
						</div>

						{/* Submit */}
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-green-500 text-white font-medium py-2 rounded-lg hover:bg-green-600 transition disabled:opacity-60"
						>
							{loading ? 'Signing in…' : 'Login'}
						</button>

						{err && <p className="text-red-600 text-sm mt-2">{err}</p>}

						<div className="text-sm text-gray-500 mt-2 text-center cursor-pointer hover:underline">
							Forgot Password
						</div>
					</form>
				</div>

				{/* Right side illustration with logo overlay */}
				<div className="flex-1 bg-sky-50 flex items-center justify-center relative">
					<img
						src="/images/productLogo.png"
						alt="login illustration"
						className="max-h-72 mt-32"
					/>
					<img
						src="/images/Logo.png"
						alt="Company Logo"
						className="absolute top-10 left-1/2 -translate-x-1/2 h-28 w-auto"
					/>
				</div>
			</div>
		</div>
	);
}
