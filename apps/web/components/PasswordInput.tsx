'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput({
	label,
	value,
	onChange,
	name,
	autoComplete,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	name: string;
	autoComplete: string;
	placeholder?: string;
}) {
	const [show, setShow] = useState(false);

	return (
		<div className="space-y-1">
			<label htmlFor={name} className="block text-sm font-medium">
				{label}
			</label>
			<div className="relative">
				<input
					id={name}
					name={name}
					type={show ? 'text' : 'password'}
					autoComplete={autoComplete}
					value={value ?? ''} // avoid undefined
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className="w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-emerald-500 outline-none"
				/>
				<button
					type="button"
					onClick={() => setShow(!show)}
					className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
					aria-label={show ? 'Hide password' : 'Show password'}
				>
					{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
				</button>
			</div>
		</div>
	);
}
