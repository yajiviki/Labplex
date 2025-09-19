'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
	const [userName, setUserName] = useState('');
	const [password, setPassword] = useState('');
	const [captcha, setCaptcha] = useState('');
	const [generatedCaptcha, setGeneratedCaptcha] = useState('');
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	// generate a new captcha
	const generateCaptcha = () => {
		const newCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit
		setGeneratedCaptcha(newCode);
		setCaptcha('');
	};

	useEffect(() => {
		generateCaptcha(); // generate on first render
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setErr(null);

		// Captcha validation
		if (captcha !== generatedCaptcha) {
			setErr('Invalid captcha. Please try again.');
			setLoading(false);
			return;
		}

		const res = await signIn('credentials', {
			redirect: true,
			callbackUrl: '/dashboard',
			username: userName, // 🔹 depends on your backend auth key
			password,
		});

		if ((res as any)?.error) setErr((res as any).error);
		setLoading(false);
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-sky-100 to-sky-200">
			<div className="bg-white rounded-2xl shadow-lg flex w-[900px] max-w-full overflow-hidden">

				{/* Left side: form */}
				<div className="flex-1 p-10">
					<h2 className="text-2xl font-bold mb-6">
						Log In
					</h2>

					<form onSubmit={onSubmit} className="space-y-4">
						{/* User Name */}
						<div>
							<label className="block text-sm font-medium mb-1">User Name</label>
							<input
								type="text"
								placeholder="Enter Employee ID (only number)"
								value={userName}
								onChange={(e) => setUserName(e.target.value)}
								className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
							/>
						</div>

						{/* Password */}
						<div>
							<label className="block text-sm font-medium mb-1">Password</label>
							<input
								type="password"
								placeholder="Enter Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
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
							/>
							<button
								type="button"
								onClick={generateCaptcha}
								className="p-2 border rounded-lg hover:bg-gray-100"
							>
								⟳
							</button>
						</div>

						{/* Submit */}
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-green-500 text-white font-medium py-2 rounded-lg hover:bg-green-600 transition"
						>
							{loading ? 'Signing in…' : 'Login'}
						</button>

						{err && <p className="text-red-600 text-sm mt-2">{err}</p>}

						<div className="text-sm text-gray-500 mt-2 text-center cursor-pointer hover:underline">
							Forgot Password
						</div>
					</form>
				</div>

				{/* Right side illustration */}
				<div className="flex-1 bg-sky-50 flex items-center justify-center">
					<img src="/images/productLogo.png" alt="login illustration" className="max-h-82" />
				</div>
			</div>
		</div>
	);
}
